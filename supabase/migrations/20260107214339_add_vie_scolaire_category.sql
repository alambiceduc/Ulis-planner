/*
  # Add VIE SCOLAIRE category

  1. Changes to events table
    - Update CHECK constraint to allow 'VIE_SCOLAIRE' event type
    - VIE_SCOLAIRE is for breaks (Récréation) and lunch (Cantine)
  
  2. New Settings Field
    - Add `include_vie_scolaire_in_percentages` column to students table
    - Boolean field (default: false) to control whether VIE SCOLAIRE time counts in percentage calculations
    - When false (default): VIE SCOLAIRE blocks are excluded from total time used for % calculations
    - When true: VIE SCOLAIRE blocks are included in total time
  
  3. Important Notes
    - VIE SCOLAIRE blocks will be displayed in pink color (handled in frontend)
    - VIE SCOLAIRE blocks are for "Récréation" and "Cantine" activities
    - VIE SCOLAIRE blocks are NOT included in shared timetables (ULIS/AESH/Prises en charge)
*/

-- Drop the old CHECK constraint and add a new one with VIE_SCOLAIRE
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'events_type_check'
    AND table_name = 'events'
  ) THEN
    ALTER TABLE events DROP CONSTRAINT events_type_check;
  END IF;
  
  -- Add new constraint with VIE_SCOLAIRE included
  ALTER TABLE events ADD CONSTRAINT events_type_check 
    CHECK (type IN ('ULIS', 'CLASSE', 'PRISE_EN_CHARGE', 'VIE_SCOLAIRE'));
END $$;

-- Add setting to control whether vie scolaire is included in percentage calculations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'include_vie_scolaire_in_percentages'
  ) THEN
    ALTER TABLE students ADD COLUMN include_vie_scolaire_in_percentages boolean DEFAULT false NOT NULL;
  END IF;
END $$;