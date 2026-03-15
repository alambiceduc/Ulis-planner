/*
  # Add PDF reference timetable support

  1. Changes
    - Add `reference_timetable_pdf_url` column to `students` table
      - Stores the URL of the uploaded reference class timetable PDF
      - Optional field (can be NULL)
    
  2. Notes
    - PDFs will be stored in Supabase Storage
    - This is for visual reference only - no parsing
    - Users manually recreate the timetable in the grid
*/

-- Add PDF URL column to students table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'reference_timetable_pdf_url'
  ) THEN
    ALTER TABLE students ADD COLUMN reference_timetable_pdf_url text DEFAULT NULL;
  END IF;
END $$;