/*
  # Create Overlay System for Schedule Templates and Period Profiles

  ## Overview
  This migration creates a flexible system for managing schedule overlays (breaks, lunch, etc.)
  that can vary by period. Users can create reusable templates and period-specific profiles.

  ## 1. New Tables

  ### overlay_templates
  Global templates that can be reused across periods (e.g., "Cycle 2", "Cycle 3")
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text) - Template name
  - `created_at` (timestamptz)

  ### overlay_template_items
  Individual time slots within a template
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `template_id` (uuid, references overlay_templates)
  - `name` (text) - e.g., "Récréation", "Cantine"
  - `days` (integer array) - Days of week [1-5]
  - `start_time` (text) - Format HH:MM
  - `end_time` (text) - Format HH:MM
  - `color` (text) - CSS color class
  - `is_enabled` (boolean) - Can be toggled on/off
  - `created_at` (timestamptz)

  ### overlay_period_profiles
  Period-specific profiles that can be created from scratch or copied from templates
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `period_id` (uuid, references periods)
  - `name` (text) - Profile name
  - `source_template_id` (uuid, nullable, references overlay_templates) - Original template if copied
  - `created_at` (timestamptz)

  ### overlay_period_items
  Individual time slots within a period profile
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `period_profile_id` (uuid, references overlay_period_profiles)
  - `name` (text) - e.g., "Récréation", "Cantine"
  - `days` (integer array) - Days of week [1-5]
  - `start_time` (text) - Format HH:MM
  - `end_time` (text) - Format HH:MM
  - `color` (text) - CSS color class
  - `is_enabled` (boolean) - Can be toggled on/off
  - `created_at` (timestamptz)

  ## 2. Student Table Modification
  - Add `overlay_period_profile_id` column to students table
  - Links student to a specific period profile

  ## 3. Security
  - Enable RLS on all new tables
  - Policies ensure users can only access their own data
  - All operations require authentication

  ## 4. Important Notes
  - Modifying a period profile does NOT modify the source template
  - Each student in a period can be assigned to a different profile
  - Overlays are displayed as transparent layers over the timetable grid
  - Templates are reusable across periods, profiles are period-specific
*/

-- Create overlay_templates table
CREATE TABLE IF NOT EXISTS overlay_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create overlay_template_items table
CREATE TABLE IF NOT EXISTS overlay_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES overlay_templates(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  days integer[] NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  color text DEFAULT 'bg-pink-400' NOT NULL,
  is_enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create overlay_period_profiles table
CREATE TABLE IF NOT EXISTS overlay_period_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_id uuid REFERENCES periods(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  source_template_id uuid REFERENCES overlay_templates(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create overlay_period_items table
CREATE TABLE IF NOT EXISTS overlay_period_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_profile_id uuid REFERENCES overlay_period_profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  days integer[] NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  color text DEFAULT 'bg-pink-400' NOT NULL,
  is_enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add overlay_period_profile_id to students table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'overlay_period_profile_id'
  ) THEN
    ALTER TABLE students ADD COLUMN overlay_period_profile_id uuid REFERENCES overlay_period_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE overlay_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_period_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_period_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for overlay_templates
CREATE POLICY "Users can view own templates"
  ON overlay_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates"
  ON overlay_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON overlay_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates"
  ON overlay_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for overlay_template_items
CREATE POLICY "Users can view own template items"
  ON overlay_template_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own template items"
  ON overlay_template_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own template items"
  ON overlay_template_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own template items"
  ON overlay_template_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for overlay_period_profiles
CREATE POLICY "Users can view own period profiles"
  ON overlay_period_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own period profiles"
  ON overlay_period_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own period profiles"
  ON overlay_period_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own period profiles"
  ON overlay_period_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for overlay_period_items
CREATE POLICY "Users can view own period items"
  ON overlay_period_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own period items"
  ON overlay_period_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own period items"
  ON overlay_period_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own period items"
  ON overlay_period_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_overlay_templates_user_id ON overlay_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_overlay_template_items_template_id ON overlay_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_overlay_template_items_user_id ON overlay_template_items(user_id);
CREATE INDEX IF NOT EXISTS idx_overlay_period_profiles_user_id ON overlay_period_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_overlay_period_profiles_period_id ON overlay_period_profiles(period_id);
CREATE INDEX IF NOT EXISTS idx_overlay_period_items_profile_id ON overlay_period_items(period_profile_id);
CREATE INDEX IF NOT EXISTS idx_overlay_period_items_user_id ON overlay_period_items(user_id);
CREATE INDEX IF NOT EXISTS idx_students_overlay_profile_id ON students(overlay_period_profile_id);