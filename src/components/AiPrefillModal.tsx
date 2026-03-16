import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Sparkles, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Student, EventType } from '../lib/database.types';

interface AiPrefillModalProps {
  student: Student;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedEvent {
  day_of_week: number;
  start_time: string;
  end_time: string;
  type: EventType;
  label: string;
  location: string;
  aesh: boolean;
}

const DAY_LABELS: Record<number, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
};

const TYPE_LABELS: Record<EventType, string> = {
  ULIS: 'ULIS',
  CLASSE: 'Classe',
  PRISE_EN_CHARGE: 'Prise en charge',
  VIE_SCOLAIRE: 'Vie scolaire',
};

const TYPE_COLORS: Record<EventType, string> = {
  ULIS: 'bg-blue-100 text-blue-800 border-blue-200',
  CLASSE: 'bg-green-100 text-green-800 border-green-200',
  PRISE_EN_CHARGE: 'bg-gray-100 text-gray-800 border-gray-200',
  VIE_SCOLAIRE: 'bg-pink-100 text-pink-800 border-pink-200',
};

export function AiPrefillModal({ student, onClose, onSuccess }: AiPrefillModalProps) {
  const [step, setStep] = useState<'upload' | 'loading' | 'preview' | 'saving' | 'done'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const analyzeWithAI = async (file: File) => {
    setStep('loading');
    setError(null);

    try {
      const base64Data = await toBase64(file);
      const mimeType = file.type || 'application/octet-stream';

      // Préparer le message selon le type de fichier
      const isImage = mimeType.startsWith('image/');
      const isPdf = mimeType === 'application/pdf';

      let messageContent: any[];

      const systemPrompt = `Tu es un assistant spécialisé dans l'analyse d'emplois du temps scolaires ULIS (Unité Localisée pour l'Inclusion Scolaire).
Tu dois extraire les créneaux horaires d'inclusion d'un élève ULIS depuis un document fourni.

Les créneaux d'inclusion sont les heures où l'élève est en classe ordinaire (pas en ULIS).
Chaque créneau doit être classé dans l'un de ces types :
- CLASSE : temps en classe ordinaire (inclusion)
- ULIS : temps dans le dispositif ULIS
- PRISE_EN_CHARGE : interventions extérieures (orthophonie, psychologue, kiné, etc.)
- VIE_SCOLAIRE : récréation, cantine, temps de vie scolaire

Réponds UNIQUEMENT avec un JSON valide, sans texte avant ni après, sans backticks.
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

      if (isImage) {
        messageContent = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: "Analyse cet emploi du temps scolaire et extrait tous les créneaux horaires de l'élève ULIS. Identifie les heures d'inclusion en classe ordinaire, les temps en ULIS, les prises en charge, et les temps de vie scolaire.",
          },
        ];
      } else if (isPdf) {
        messageContent = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: "Analyse cet emploi du temps scolaire et extrait tous les créneaux horaires de l'élève ULIS. Identifie les heures d'inclusion en classe ordinaire, les temps en ULIS, les prises en charge, et les temps de vie scolaire.",
          },
        ];
      } else {
        // Fichier texte/Word : on lit le texte brut
        const textContent = await file.text();
        messageContent = [
          {
            type: 'text',
            text: `Voici le contenu d'un emploi du temps scolaire :\n\n${textContent}\n\nAnalyse cet emploi du temps et extrait tous les créneaux horaires de l'élève ULIS.`,
          },
        ];
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: messageContent,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur API : ${response.status}`);
      }

      const data = await response.json();
      const text = data.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
        .join('');

      // Nettoyer et parser le JSON
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (!parsed.events || !Array.isArray(parsed.events)) {
        throw new Error('Format de réponse inattendu');
      }

      // Valider et filtrer les événements
      const validEvents: ParsedEvent[] = parsed.events.filter((e: any) => {
        return (
          e.day_of_week >= 1 &&
          e.day_of_week <= 5 &&
          /^\d{2}:\d{2}$/.test(e.start_time) &&
          /^\d{2}:\d{2}$/.test(e.end_time) &&
          ['CLASSE', 'ULIS', 'PRISE_EN_CHARGE', 'VIE_SCOLAIRE'].includes(e.type)
        );
      });

      if (validEvents.length === 0) {
        throw new Error("Aucun créneau horaire valide trouvé dans le document. Vérifiez que le document contient bien un emploi du temps.");
      }

      // Trier par jour puis par heure
      validEvents.sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
        return a.start_time.localeCompare(b.start_time);
      });

      setParsedEvents(validEvents);
      setStep('preview');
    } catch (err: any) {
      console.error('Erreur analyse IA:', err);
      if (err.message.includes('JSON')) {
        setError("L'IA n'a pas pu extraire les créneaux. Essayez avec une image plus nette ou un fichier texte.");
      } else {
        setError(err.message || "Une erreur est survenue lors de l'analyse.");
      }
      setStep('upload');
    }
  };

  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleAnalyze = () => {
    if (selectedFile) analyzeWithAI(selectedFile);
  };

  const removeEvent = (index: number) => {
    setParsedEvents(parsedEvents.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (parsedEvents.length === 0) return;
    setStep('saving');

    try {
      const eventsToInsert = parsedEvents.map(e => ({
        student_id: student.id,
        day_of_week: e.day_of_week,
        start_time: e.start_time,
        end_time: e.end_time,
        type: e.type,
        aesh: e.aesh,
        label: e.label,
        location: e.location,
      }));

      const { error: insertError } = await supabase
        .from('events')
        .insert(eventsToInsert as any);

      if (insertError) throw insertError;

      setStep('done');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Erreur sauvegarde:', err);
      setError("Erreur lors de l'enregistrement. Réessayez.");
      setStep('preview');
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      style={{ zIndex: 99999 }}
    >
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Pré-remplissage IA</h2>
              <p className="text-sm text-gray-500">
                {student.first_name} {student.last_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Étape 1 : Upload */}
        {step === 'upload' && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">
              Déposez l'emploi du temps de l'élève. L'IA analysera le document et créera automatiquement les créneaux dans le planning.
            </p>

            {/* Zone de dépôt */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                selectedFile
                  ? 'border-violet-400 bg-violet-50'
                  : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileChange(file);
                }}
              />
              <Upload className={`w-10 h-10 mx-auto mb-3 ${selectedFile ? 'text-violet-500' : 'text-gray-400'}`} />
              {selectedFile ? (
                <div>
                  <p className="font-semibold text-violet-700">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500 mt-1">Cliquez pour changer de fichier</p>
                </div>
              ) : (
                <div>
                  <p className="font-medium text-gray-700">Glissez un fichier ici</p>
                  <p className="text-sm text-gray-400 mt-1">ou cliquez pour sélectionner</p>
                  <p className="text-xs text-gray-400 mt-2">PDF, image (JPG, PNG), fichier texte</p>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!selectedFile}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
              >
                <Sparkles className="w-5 h-5" />
                Analyser avec l'IA
              </button>
            </div>
          </div>
        )}

        {/* Étape 2 : Chargement */}
        {step === 'loading' && (
          <div className="py-12 text-center space-y-4">
            <Loader className="w-12 h-12 text-violet-500 mx-auto animate-spin" />
            <p className="font-semibold text-gray-700">Analyse en cours…</p>
            <p className="text-sm text-gray-400">L'IA lit l'emploi du temps et extrait les créneaux</p>
          </div>
        )}

        {/* Étape 3 : Prévisualisation */}
        {step === 'preview' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800 font-medium">
                {parsedEvents.length} créneau{parsedEvents.length > 1 ? 'x' : ''} détecté{parsedEvents.length > 1 ? 's' : ''}. Vérifiez et supprimez ce qui ne convient pas.
              </p>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {parsedEvents.map((event, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-700 w-16 flex-shrink-0">
                        {DAY_LABELS[event.day_of_week]}
                      </span>
                      <span className="text-sm text-gray-500 font-mono">
                        {event.start_time} – {event.end_time}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${TYPE_COLORS[event.type]}`}>
                        {TYPE_LABELS[event.type]}
                      </span>
                      {event.aesh && (
                        <span className="text-xs px-2 py-0.5 rounded border bg-orange-100 text-orange-700 border-orange-200 font-medium">
                          AESH
                        </span>
                      )}
                    </div>
                    {(event.label || event.location) && (
                      <p className="text-xs text-gray-400 mt-0.5 ml-[4.5rem]">
                        {[event.label, event.location].filter(Boolean).join(' — ')}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeEvent(index)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all flex-shrink-0"
                    title="Supprimer ce créneau"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setStep('upload'); setSelectedFile(null); }}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Recommencer
              </button>
              <button
                onClick={handleSave}
                disabled={parsedEvents.length === 0}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors disabled:opacity-40 font-semibold"
              >
                Ajouter {parsedEvents.length} créneau{parsedEvents.length > 1 ? 'x' : ''} →
              </button>
            </div>
          </div>
        )}

        {/* Étape 4 : Sauvegarde */}
        {step === 'saving' && (
          <div className="py-12 text-center space-y-4">
            <Loader className="w-12 h-12 text-violet-500 mx-auto animate-spin" />
            <p className="font-semibold text-gray-700">Enregistrement…</p>
          </div>
        )}

        {/* Étape 5 : Succès */}
        {step === 'done' && (
          <div className="py-12 text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <p className="font-semibold text-gray-700">Planning mis à jour !</p>
            <p className="text-sm text-gray-400">Les créneaux ont été ajoutés avec succès.</p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
