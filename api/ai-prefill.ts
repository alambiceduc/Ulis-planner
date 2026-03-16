import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Clé API manquante côté serveur' });

  try {
    const { fileData, mimeType, fileName } = req.body;
    if (!fileData || !mimeType) return res.status(400).json({ error: 'Données manquantes' });

    const systemPrompt = `Tu es un extracteur de données JSON pour emplois du temps scolaires ULIS.
Tu ne réponds JAMAIS en langage naturel. Tu ne fais JAMAIS de commentaires.
Ta réponse est TOUJOURS et UNIQUEMENT un objet JSON valide, rien d'autre.

Types disponibles :
- CLASSE : temps en classe ordinaire (inclusion)
- ULIS : temps dans le dispositif ULIS
- PRISE_EN_CHARGE : orthophonie, psychologue, kiné, etc.
- VIE_SCOLAIRE : récréation, cantine

Format de réponse OBLIGATOIRE (rien avant, rien après) :
{"events":[{"day_of_week":1,"start_time":"08:30","end_time":"10:00","type":"CLASSE","label":"Maths","location":"CE2","aesh":false}]}

Règles :
- day_of_week : 1=Lundi 2=Mardi 3=Mercredi 4=Jeudi 5=Vendredi
- start_time / end_time : format HH:MM
- label et location peuvent être ""
- aesh : true si AESH mentionné, sinon false`;

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    let messageContent: any[];

    if (isImage) {
      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileData } },
        { type: 'text', text: 'Extrais tous les créneaux horaires de cet emploi du temps. Réponds uniquement en JSON.' }
      ];
    } else if (isPdf) {
      messageContent = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileData } },
        { type: 'text', text: 'Extrais tous les créneaux horaires de cet emploi du temps. Réponds uniquement en JSON.' }
      ];
    } else {
      messageContent = [
        { type: 'text', text: `Emploi du temps (${fileName || 'document'}) :\n\n${fileData}\n\nExtrais tous les créneaux. Réponds uniquement en JSON.` }
      ];
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: messageContent }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', errText);
      return res.status(500).json({ error: `Erreur API Anthropic : ${anthropicRes.status}` });
    }

    const data = await anthropicRes.json();
    const rawText = data.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');

    // Extraction robuste : cherche le premier {...} même si du texte parasite subsiste
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Pas de JSON dans la réponse IA:', rawText.slice(0, 300));
      return res.status(500).json({ error: "La réponse de l'IA ne contient pas de JSON valide" });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err: any) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Erreur interne' });
  }
}
