# ULIS Planner

Application web responsive pour la gestion d'emplois du temps individuels pour les élèves ULIS école.

## Fonctionnalités

### Authentification
- Inscription et connexion par email/mot de passe via Supabase
- Isolation des données par utilisateur avec Row Level Security (RLS)

### Gestion des périodes
- 5 périodes scolaires (P1 à P5)
- Navigation simple et intuitive

### Gestion des élèves
- Jusqu'à 14 élèves par période
- Ajout, modification et suppression d'élèves
- Visualisation de l'emploi du temps individuel

### Emplois du temps individuels
- **Interface split-screen** : PDF de référence à gauche, grille d'édition à droite
- **Dépôt de PDF** : téléchargez l'emploi du temps de la classe de référence pour faciliter la saisie
  - Le PDF sert uniquement de référence visuelle
  - Pas de parsing automatique : vous recréez manuellement l'emploi du temps dans la grille
  - Boutons "Remplacer le PDF" et "Supprimer le PDF"
  - Bouton pour masquer/afficher le PDF
- Grille hebdomadaire (Lundi à Vendredi)
- Créneaux configurables (par défaut 08:30-16:30, pas de 30 minutes)
- Ajout et édition de blocs colorés :
  - **ULIS** (bleu) : temps passé en dispositif ULIS
  - **CLASSE** (vert) : temps d'inclusion en classe ordinaire
  - **PRISE_EN_CHARGE** (blanc) : prises en charge externes (orthophonie, etc.)
- Toggle AESH avec indicateur orange
- Libellé et lieu personnalisables pour chaque bloc

### Statistiques automatiques
- Total hebdomadaire en heures
- Pourcentages par type :
  - Temps ULIS
  - Taux d'inclusion (temps en classe)
  - Prises en charge
  - Accompagnement AESH

### Emplois du temps communs
Génération automatique de 3 vues consolidées :
1. **EDT ULIS** : regroupe tous les créneaux ULIS avec liste des élèves
2. **EDT AESH** : regroupe tous les créneaux nécessitant un AESH
3. **EDT Prises en charge** : regroupe toutes les prises en charge externes

### Export et impression
- Impression optimisée pour A4
- Fonction print navigateur (Ctrl+P / Cmd+P)
- Couleurs préservées à l'impression

## Installation

### Prérequis
- Node.js 18+ et npm
- Compte Supabase (gratuit)

### Configuration

1. Cloner le projet et installer les dépendances :
```bash
npm install
```

2. Les variables d'environnement Supabase sont déjà configurées dans le fichier `.env`

3. La base de données a été créée automatiquement avec les tables suivantes :
   - `user_settings` : paramètres utilisateur
   - `periods` : périodes scolaires (P1-P5)
   - `students` : élèves (avec support de PDF de référence)
   - `events` : événements d'emploi du temps
   - Bucket storage `reference-timetables` : stockage des PDFs

### Lancement

Développement :
```bash
npm run dev
```

Build production :
```bash
npm run build
```

Preview production :
```bash
npm run preview
```

## Structure de la base de données

### Tables principales

#### `periods`
- Stocke les 5 périodes scolaires par utilisateur
- Chaque période peut contenir jusqu'à 14 élèves

#### `students`
- Informations des élèves (prénom, nom)
- Liés à une période spécifique

#### `events`
- Blocs d'emploi du temps
- Propriétés : jour, heure début/fin, type, AESH, libellé, lieu
- Types : ULIS, CLASSE, PRISE_EN_CHARGE

#### `user_settings`
- Configuration personnalisée (amplitude horaire, pas de temps)
- Valeurs par défaut : 08:30-16:30, pas de 30 min

### Sécurité (RLS)

Toutes les tables sont protégées par Row Level Security :
- Les utilisateurs ne peuvent accéder qu'à leurs propres données
- Politiques strictes sur toutes les opérations (SELECT, INSERT, UPDATE, DELETE)

## Architecture technique

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le build
- **Tailwind CSS** pour le style
- **Lucide React** pour les icônes

### Backend
- **Supabase** :
  - Base de données PostgreSQL
  - Authentication
  - Row Level Security
  - Storage (PDFs des emplois du temps de référence)

### Composants principaux
- `Auth.tsx` : authentification
- `PeriodSelector.tsx` : sélection de période
- `StudentList.tsx` : liste des élèves
- `TimetableGrid.tsx` : grille d'emploi du temps individuel avec split-screen
- `PdfViewer.tsx` : visualisation et gestion des PDFs de référence
- `EventModal.tsx` : formulaire d'ajout/édition d'événement
- `EventBlock.tsx` : affichage d'un bloc d'événement
- `SummaryStats.tsx` : statistiques calculées
- `SharedTimetables.tsx` : emplois du temps communs

## Utilisation

1. **Inscription/Connexion** : créer un compte ou se connecter
2. **Sélectionner une période** : choisir parmi P1 à P5
3. **Ajouter des élèves** : cliquer sur "Ajouter un élève"
4. **Créer un emploi du temps** :
   - Cliquer sur un élève
   - **(Optionnel)** Déposer le PDF de la classe de référence pour le consulter pendant la saisie
   - Cliquer sur une case vide dans la grille
   - Remplir le formulaire (jour, horaires, type, libellé, lieu)
   - Cocher AESH si nécessaire
   - Utiliser le bouton avec chevrons pour masquer/afficher le PDF si besoin
5. **Voir les statistiques** : cliquer sur "Voir stats"
6. **Générer les EDT communs** : cliquer sur "EDT communs"
7. **Imprimer** : cliquer sur "Imprimer" puis Ctrl+P

## Design

Interface moderne et professionnelle avec :
- Dégradés bleu-vert harmonieux
- Couleurs codées par type d'activité
- Design responsive (mobile, tablette, desktop)
- Animations subtiles et transitions fluides
- Mise en page optimisée pour l'impression A4

## Support navigateurs

- Chrome, Firefox, Safari, Edge (versions récentes)
- Impression optimisée sur tous navigateurs modernes
