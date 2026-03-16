// Mapping automatique emoji → mots-clés dans le label du créneau
// Utilisé dans EventModal (sélection) et EventBlock (affichage)

export const PICTO_LIST = [
  { emoji: '🔢', label: 'Mathématiques' },
  { emoji: '📖', label: 'Lecture' },
  { emoji: '✏️', label: 'Écriture' },
  { emoji: '📝', label: 'Dictée' },
  { emoji: '🔤', label: 'Français' },
  { emoji: '🔠', label: 'Orthographe' },
  { emoji: '🔡', label: 'Conjugaison' },
  { emoji: '📚', label: 'Grammaire' },
  { emoji: '🌍', label: 'Géographie' },
  { emoji: '🏛️', label: 'Histoire' },
  { emoji: '🔬', label: 'Sciences' },
  { emoji: '🎨', label: 'Arts plastiques' },
  { emoji: '🎵', label: 'Musique' },
  { emoji: '⚽', label: 'EPS / Sport' },
  { emoji: '💻', label: 'Informatique' },
  { emoji: '🗣️', label: 'Oral / Exposé' },
  { emoji: '🔔', label: 'Rituels' },
  { emoji: '⛹️', label: 'Récréation' },
  { emoji: '🍽️', label: 'Cantine' },
  { emoji: '🧘', label: 'Relaxation' },
  { emoji: '🧩', label: 'Jeux' },
  { emoji: '📐', label: 'Calcul mental' },
  { emoji: '🗺️', label: 'EMC / Citoyenneté' },
  { emoji: '🌱', label: 'Nature / Jardin' },
  { emoji: '🎭', label: 'Théâtre' },
  { emoji: '📷', label: 'Photo / Vidéo' },
  { emoji: '🏥', label: 'Orthophonie' },
  { emoji: '🧠', label: 'Psychologue' },
  { emoji: '🏃', label: 'Kiné / Psychomotricité' },
  { emoji: '⭐', label: 'Autre' },
];

// Mots-clés pour l'auto-détection
const KEYWORD_MAP: { keywords: string[]; emoji: string }[] = [
  { keywords: ['math', 'calcul', 'nombre', 'numér'], emoji: '🔢' },
  { keywords: ['lecture', 'lire', 'livre'], emoji: '📖' },
  { keywords: ['écrit', 'écriture', 'copie'], emoji: '✏️' },
  { keywords: ['dictée'], emoji: '📝' },
  { keywords: ['français', 'langue'], emoji: '🔤' },
  { keywords: ['orthograph'], emoji: '🔠' },
  { keywords: ['conjugaison', 'verbe'], emoji: '🔡' },
  { keywords: ['grammaire', 'vocabulaire', 'lexique'], emoji: '📚' },
  { keywords: ['géograph', 'carte'], emoji: '🌍' },
  { keywords: ['histoire', 'histoire-géo'], emoji: '🏛️' },
  { keywords: ['science', 'expérience', 'biologie'], emoji: '🔬' },
  { keywords: ['art', 'dessin', 'peinture', 'plastique'], emoji: '🎨' },
  { keywords: ['musique', 'chant', 'chorale'], emoji: '🎵' },
  { keywords: ['eps', 'sport', 'gym', 'natation', 'piscine', 'foot'], emoji: '⚽' },
  { keywords: ['informati', 'numérique', 'ordi', 'tablette'], emoji: '💻' },
  { keywords: ['oral', 'exposé', 'parole'], emoji: '🗣️' },
  { keywords: ['rituel'], emoji: '🔔' },
  { keywords: ['récré', 'pause', 'cour'], emoji: '⛹️' },
  { keywords: ['cantine', 'repas', 'déjeuner', 'midi'], emoji: '🍽️' },
  { keywords: ['relaxation', 'sophrologie', 'respiration'], emoji: '🧘' },
  { keywords: ['jeu', 'atelier libre'], emoji: '🧩' },
  { keywords: ['mental'], emoji: '📐' },
  { keywords: ['emc', 'civisme', 'citoyen'], emoji: '🗺️' },
  { keywords: ['orthophoni'], emoji: '🏥' },
  { keywords: ['psychologue', 'psy'], emoji: '🧠' },
  { keywords: ['kiné', 'psychomotric', 'motricité'], emoji: '🏃' },
  { keywords: ['théâtre', 'spectacle'], emoji: '🎭' },
];

/**
 * Retourne un emoji automatique basé sur le label du créneau.
 * Si rien ne correspond, retourne '⭐'.
 */
export function getAutoPicto(label: string): string {
  if (!label) return '⭐';
  const lower = label.toLowerCase();
  for (const { keywords, emoji } of KEYWORD_MAP) {
    if (keywords.some(k => lower.includes(k))) return emoji;
  }
  return '⭐';
}
