# Conventions de Code

## Principes généraux

### 1. Séparation des responsabilités
- **Services** : Gestion des données (appels Supabase)
- **Hooks** : Logique métier réutilisable
- **Components** : Uniquement l'UI et la présentation
- **Utils** : Fonctions pures sans effets de bord

### 2. Nommage

#### Fichiers
- Composants React : `PascalCase.tsx` (ex: `StudentList.tsx`)
- Services : `camelCase.service.ts` (ex: `students.service.ts`)
- Hooks : `camelCase.ts` (ex: `useStudents.ts`)
- Utils : `camelCase.ts` (ex: `time.ts`)
- Types : `index.ts` dans le dossier `types/`

#### Variables et fonctions
```typescript
// Variables : camelCase
const studentList = [];
const isLoading = false;

// Fonctions : camelCase avec verbe
function loadStudents() {}
function calculateDuration() {}

// Constantes : UPPER_SNAKE_CASE
const DEFAULT_START_TIME = '08:30';
const EVENT_TYPE_CONFIG = {...};

// Types : PascalCase
type EventType = 'ULIS' | 'CLASSE';
interface Student {...}
```

### 3. Import organization

```typescript
// 1. React imports
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import { ArrowLeft, Plus } from 'lucide-react';

// 3. Services
import { studentsService } from '../services/students.service';

// 4. Hooks
import { useStudents } from '../hooks/useStudents';

// 5. Components
import { StudentCard } from './StudentCard';

// 6. Types
import type { Student, Event } from '../types';

// 7. Utils
import { formatMinutesToDisplay } from '../utils/time';

// 8. Constants
import { DAYS, EVENT_TYPE_CONFIG } from '../constants';
```

### 4. Gestion des erreurs

```typescript
// ✅ BON : Log l'erreur et retourne une valeur par défaut
async function loadStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*');

  if (error) {
    console.error('Error loading students:', error);
    return [];
  }

  return data || [];
}

// ❌ MAUVAIS : Lance une exception sans gestion
async function loadStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('students').select('*');
  if (error) throw error; // Non géré par l'appelant
  return data;
}
```

### 5. Hooks personnalisés

```typescript
// Structure type d'un hook
export function useStudents(periodId: string | null) {
  // 1. États
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);

  // 2. Callbacks avec useCallback
  const loadStudents = useCallback(async () => {
    if (!periodId) {
      setStudents([]);
      return;
    }

    setLoading(true);
    const data = await studentsService.getByPeriod(periodId);
    setStudents(data);
    setLoading(false);
  }, [periodId]);

  // 3. Effets
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // 4. Retour explicite
  return {
    students,
    loading,
    reloadStudents: loadStudents
  };
}
```

### 6. Composants React

```typescript
// Interface des props en premier
interface StudentCardProps {
  student: Student;
  onSelect: (student: Student) => void;
  onDelete: (id: string) => void;
}

// Composant fonctionnel avec destructuration
export function StudentCard({ student, onSelect, onDelete }: StudentCardProps) {
  // 1. Hooks
  const [isHovered, setIsHovered] = useState(false);

  // 2. Callbacks
  const handleClick = useCallback(() => {
    onSelect(student);
  }, [student, onSelect]);

  // 3. Rendu
  return (
    <div
      className="..."
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Contenu */}
    </div>
  );
}
```

### 7. Optimisation des performances

#### useMemo pour les calculs coûteux
```typescript
const stats = useMemo(() => {
  // Calculs complexes ici
  return computedStats;
}, [events, includeVieScolaire]);
```

#### useCallback pour les fonctions passées en props
```typescript
const handleDelete = useCallback((id: string) => {
  // Logique de suppression
}, [/* dépendances */]);
```

#### Éviter les fonctions inline dans le JSX
```typescript
// ❌ MAUVAIS : Crée une nouvelle fonction à chaque render
<button onClick={() => onDelete(student.id)}>Delete</button>

// ✅ BON : Fonction stable
const handleDelete = useCallback(() => {
  onDelete(student.id);
}, [student.id, onDelete]);

<button onClick={handleDelete}>Delete</button>
```

### 8. Types TypeScript

```typescript
// Préférer les types aux interfaces pour les unions
type EventType = 'ULIS' | 'CLASSE' | 'PRISE_EN_CHARGE' | 'VIE_SCOLAIRE';

// Utiliser les interfaces pour les objets
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  // ...
}

// Toujours typer les props des composants
interface ComponentProps {
  value: string;
  onChange: (value: string) => void;
}

// Typer les retours de fonction
function loadStudents(): Promise<Student[]> {
  // ...
}
```

### 9. Services

```typescript
// Pattern standard pour un service
export const studentsService = {
  // Méthodes nommées avec des verbes d'action
  async getById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .maybeSingle(); // Pas d'erreur si aucun résultat

    if (error) {
      console.error('Error loading student:', error);
      return null;
    }

    return data as Student | null;
  },

  async create(data: CreateStudentData): Promise<Student | null> {
    // ...
  },

  // Toujours retourner null ou [] en cas d'erreur
  // Ne pas lancer d'exceptions
};
```

### 10. Commentaires

```typescript
// ✅ BON : Commentaire qui explique le POURQUOI
// VIE_SCOLAIRE est le seul type exclu des calculs de pourcentages par défaut
const eventsForStats = events.filter(e => e.type !== 'VIE_SCOLAIRE');

// ❌ MAUVAIS : Commentaire qui répète le code
// Filtre les événements
const filtered = events.filter(e => e.type !== 'VIE_SCOLAIRE');

// ✅ BON : Commentaire pour logique métier complexe
// Calcul du pourcentage avec arrondi : si le total est 0, on retourne 0 pour éviter NaN
const percentage = totalMinutes === 0 ? 0 : Math.round((minutes / totalMinutes) * 100);
```

### 11. Styles Tailwind

```typescript
// Grouper les classes par catégorie
<div className="
  flex items-center gap-2      // Layout
  px-4 py-2                     // Spacing
  bg-blue-600 hover:bg-blue-700 // Colors
  text-white                    // Text
  rounded-lg                    // Borders
  transition-colors             // Animations
">
```

### 12. Gestion des états de chargement

```typescript
// Toujours avoir un état de chargement
const [loading, setLoading] = useState(false);

// Afficher un état de chargement approprié
if (loading) {
  return <div>Chargement...</div>;
}

// Gérer le cas vide
if (students.length === 0) {
  return <div>Aucun élève</div>;
}

// Afficher les données
return <StudentList students={students} />;
```

## Bonnes pratiques spécifiques au projet

### Gestion du temps
- Toujours utiliser `timeToMinutes()` pour les comparaisons
- Formater avec `formatMinutesToDisplay()` pour l'affichage
- Valider avec `isValidTimeRange()` avant insertion
- Utiliser `calculateSlotHeight()` pour garantir la lisibilité des grilles

### Lisibilité garantie à 100% de zoom
**Principe non négociable :** L'interface doit être pleinement lisible à 100% de zoom sans manipulation.

```typescript
// Calcul de la hauteur optimale des slots
const slotHeightRem = useMemo(() => {
  return calculateSlotHeight(
    step,                              // Pas de temps (ex: 30 minutes)
    MIN_READABLE_HEIGHT_REM,           // Hauteur min lisible (3rem)
    MIN_READABLE_DURATION_MINUTES,     // Durée min à rendre lisible (15 min)
    zoom                               // Facteur de zoom
  );
}, [step, zoom]);

// Formule : slotHeight = (minHeight × step) / minDuration × zoom
// Exemple : (3rem × 30min) / 15min × 1 = 6rem par slot
```

**Règles :**
- Un créneau de 15 minutes doit toujours faire au minimum 3rem
- Les tailles de texte doivent être ≥ 0.65rem (10.4px)
- Le zoom est un confort, pas une obligation
- Les mêmes règles s'appliquent à l'impression

### Événements VIE_SCOLAIRE
- Toujours filtrer dans les EDT communs
- Respect du flag `include_vie_scolaire_in_percentages`
- Permettre la sélection multi-jours uniquement pour VIE_SCOLAIRE

### Sécurité
- Toujours vérifier `user_id` via RLS
- Ne jamais exposer de données sensibles côté client
- Utiliser `maybeSingle()` au lieu de `single()` pour éviter les erreurs

## Outils de développement

### Extensions VS Code recommandées
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Error Lens

### Scripts utiles
```bash
npm run dev        # Développement
npm run build      # Production
npm run typecheck  # Vérification TypeScript
npm run lint       # Linting
```
