import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API manquante côté serveur' });
  }

  try {
    const { fileData, mimeType, fileName } = req.body;

    if (!fileData || !mimeType) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    const systemPrompt = `Tu es un assistant spécialisé dans l'analyse d'emplois du temps scolaires ULIS (Unité Localisée pour l'Inclusion Scolaire).
Tu dois extraire les créneaux horaires d'inclusion d'un élève ULIS depuis un document fourni.

Les créneaux d'inclusion sont les heures où l'élève est en classe ordinaire (pas en ULIS).
Chaque créneau doit être classé dans l'un de ces types :
- CLASSE : temps en classe ordinaire (inclusion)
- ULIS : temps dans le dispositif ULIS
- PRISE_EN_CHARGE : interventions extérieures (orthophonie, psychologue, kiné, etc.)
- VIE_SCOLAIRE : récréation, cantine, temps de vie scolaire

IMPORTANT : Ta réponse doit commencer IMMÉDIATEMENT par { et se terminer par }. Aucun mot avant ou après. Pas d'explication. Pas de commentaire. Uniquement le JSON brut.

Format exact :
{
  "events": [
    {
      "day_of_week": 1,
      "start_time": "08:30",
      "end_time": "10:00",
      "type": "CLASSE",
      "label": "Maths",
      "location": "CE2 Mme Dupont",
      "aesh": false
    }
  ]
}

Règles :
- day_of_week : 1=Lundi, 2=Mardi, 3=Mercredi, 4=Jeudi, 5=Vendredi
- start_time et end_time au format HH:MM (ex: "08:30", "14:00")
- type : exactement "CLASSE", "ULIS", "PRISE_EN_CHARGE" ou "VIE_SCOLAIRE"
- label : nom de la matière ou activité (peut être vide "")
- location : salle ou enseignant (peut être vide "")
- aesh : true si accompagnement AESH mentionné, false sinon
- Si tu n'es pas sûr du type, utilise "CLASSE" par défaut pour les inclusions
- N'inclus pas les créneaux dont tu n'es pas sûr des horaires`;

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    let messageContent: any[];

    if (isImage) {
      messageContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType, data: fileData },
        },
        {
          type: 'text',
          text: "Analyse cet emploi du temps scolaire et extrait tous les créneaux horaires de l'élève ULIS.",
        },
      ];
    } else if (isPdf) {
      messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: fileData },
        },
        {
          type: 'text',
          text: "Analyse cet emploi du temps scolaire et extrait tous les créneaux horaires de l'élève ULIS.",
        },
      ];
    } else {
      messageContent = [
        {
          type: 'text',
          text: `Voici le contenu d'un emploi du temps scolaire (fichier: ${fileName || 'document'}) :\n\n${fileData}\n\nAnalyse cet emploi du temps et extrait tous les créneaux horaires de l'élève ULIS.`,
        },
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
        messages: [
          { role: 'user', content: messageContent },
          // Préfixage : force la réponse à commencer par { dès le premier token
          { role: 'assistant', content: '{' }
        ],
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

    // Réassembler avec le préfixe { qu'on a injecté
    const fullText = '{' + rawText;

    // Nettoyage défensif : extraire le JSON même si du texte parasite subsiste
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Aucun JSON trouvé dans la réponse IA:', fullText.slice(0, 200));
      return res.status(500).json({ error: 'La réponse de l\'IA ne contient pas de JSON valide' });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err: any) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Erreur interne' });
  }
}
