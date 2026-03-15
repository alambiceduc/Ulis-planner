# Architecture du Projet ULIS Planner

## Vue d'ensemble

ULIS Planner est une application de gestion d'emplois du temps pour les dispositifs ULIS. L'application utilise React + TypeScript en frontend et Supabase pour le backend (base de données PostgreSQL + authentification).

## Structure des répertoires

```
src/
├── components/           # Composants UI réutilisables
│   ├── Auth.tsx         # Formulaire de connexion/inscription
│   ├── EventBlock.tsx   # Bloc d'événement dans la grille
│   ├── EventModal.tsx   # Modal de création/édition d'événement
│   ├── OverlayDisplay.tsx
│   ├── OverlayManager.tsx
│   ├── PdfViewer.tsx    # Visualiseur de PDF de référence
│   ├── PeriodSelector.tsx  # Sélection de période scolaire
│   ├── SharedTimetables.tsx  # Emplois du temps communs
│   ├── StudentList.tsx  # Liste des élèves
│   ├── SummaryStats.tsx # Statistiques hebdomadaires
│   └── TimetableGrid.tsx  # Grille principale d'emploi du temps
│
├── contexts/
│   └── AuthContext.tsx  # Contexte d'authentification React
│
├── hooks/               # Hooks React personnalisés
│   ├── useEvents.ts     # Hook pour charger les événements
│   └── useStudents.ts   # Hook pour charger les élèves
│
├── services/            # Couche d'accès aux données
│   ├── events.service.ts     # CRUD événements
│   ├── overlays.service.ts   # Gestion des calques
│   └── students.service.ts   # CRUD élèves
│
├── types/
│   └── index.ts         # Types TypeScript centralisés
│
├── constants/
│   └── index.ts         # Constantes de l'application
│
├── utils/
│   └── time.ts          # Utilitaires de gestion du temps
│
├── lib/
│   ├── database.types.ts  # Réexport des types (rétrocompatibilité)
│   ├── supabase.ts       # Configuration client Supabase
│   └── timeUtils.ts      # Réexport des utils (rétrocompatibilité)
│
├── App.tsx              # Composant racine
├── main.tsx            # Point d'entrée React
└── index.css           # Styles globaux

supabase/
└── migrations/         # Migrations de base de données
```

## Flux de navigation

```
┌─────────────────┐
│  PeriodSelector │  → Sélection de la période (P1 à P5)
└────────┬────────┘
         │
         v
┌─────────────────┐
│  StudentList    │  → Liste des élèves de la période
└────────┬────────┘    ↓ Bouton "EDT communs"
         │             v
         │        ┌─────────────────────┐
         │        │ SharedTimetables    │
         │        │ - EDT ULIS          │
         │        │ - EDT AESH          │
         │        │ - EDT Prises en     │
         │        │   charge            │
         │        └─────────────────────┘
         v
┌─────────────────┐
│ TimetableGrid   │  → Emploi du temps individuel
│ - Grille       │
│ - Événements   │
│ - Statistiques │
│ - PDF référence│
└─────────────────┘
```

## Modèle de données

### Tables principales

#### `periods`
Périodes scolaires (P1 à P5)
```
- id (uuid)
- user_id (uuid, FK vers auth.users)
- name (P1 | P2 | P3 | P4 | P5)
- created_at (timestamp)
```

#### `students`
Élèves du dispositif ULIS
```
- id (uuid)
- user_id (uuid, FK vers auth.users)
- period_id (uuid, FK vers periods)
- first_name (text)
- last_name (text)
- reference_timetable_pdf_url (text, nullable)
- include_vie_scolaire_in_percentages (boolean)
- overlay_period_profile_id (uuid, nullable)
- created_at (timestamp)
```

#### `events`
Créneaux horaires des emplois du temps
```
- id (uuid)
- student_id (uuid, FK vers students)
- day_of_week (integer, 1-5)
- start_time (time)
- end_time (time)
- type (ULIS | CLASSE | PRISE_EN_CHARGE | VIE_SCOLAIRE)
- aesh (boolean)
- label (text)
- location (text)
- created_at (timestamp)
```

#### `overlay_templates` & `overlay_template_items`
Modèles de calques horaires réutilisables

#### `overlay_period_profiles` & `overlay_period_items`
Calques horaires appliqués aux élèves

## Types d'événements

### ULIS (bleu)
Temps passé dans le dispositif ULIS

### CLASSE (vert)
Temps d'inclusion en classe ordinaire

### PRISE_EN_CHARGE (blanc)
Interventions externes (orthophoniste, psychologue, etc.)

### VIE_SCOLAIRE (rose)
Temps de vie scolaire (récréation, cantine)
- Exclus par défaut des calculs de pourcentages
- Peuvent être fusionnés sur plusieurs jours
- Ne sont jamais inclus dans les EDT communs

## Services

### `studentsService`
```typescript
- getById(id): Promise<Student | null>
- getByPeriod(periodId): Promise<Student[]>
- create(periodId, firstName, lastName): Promise<Student | null>
- update(id, updates): Promise<boolean>
- delete(id): Promise<boolean>
```

### `eventsService`
```typescript
- getByStudent(studentId): Promise<Event[]>
- getByStudents(studentIds): Promise<Event[]>
- create(...): Promise<Event | null>
- createMultiple(events): Promise<boolean>
- update(id, updates): Promise<boolean>
- delete(id): Promise<boolean>
```

### `overlaysService`
```typescript
- getByPeriodProfile(periodProfileId): Promise<OverlayPeriodItem[]>
```

## Hooks personnalisés

### `useStudents(periodId)`
Charge automatiquement les élèves d'une période
```typescript
const { students, loading, reloadStudents } = useStudents(periodId);
```

### `useStudent(studentId)`
Charge automatiquement un élève spécifique
```typescript
const { student, loading, reloadStudent } = useStudent(studentId);
```

### `useEvents(studentId)`
Charge automatiquement les événements d'un élève
```typescript
const { events, loading, reloadEvents } = useEvents(studentId);
```

## Sécurité

### Row Level Security (RLS)
Toutes les tables sont protégées par RLS. Les utilisateurs ne peuvent accéder qu'à leurs propres données.

### Authentification
Gérée par Supabase Auth avec email/mot de passe.

## Optimisations

### Performance
- `useMemo` pour les calculs coûteux (statistiques)
- `useCallback` pour éviter les re-créations de fonctions
- Services pour centraliser et optimiser les requêtes

### Bundle
- Tree shaking automatique avec Vite
- CSS scoped avec Tailwind
- Build optimisé pour production

## Technologies

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Build**: Vite
- **Icons**: Lucide React
