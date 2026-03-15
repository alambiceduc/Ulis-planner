/*
  # ULIS Planner Database Schema

  1. New Tables
    - `user_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `start_time` (text, default '08:30')
      - `end_time` (text, default '16:30')
      - `time_step` (integer, default 30 minutes)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `periods`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text, P1-P5)
      - `created_at` (timestamptz)
    
    - `students`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `period_id` (uuid, references periods)
      - `first_name` (text)
      - `last_name` (text, optional)
      - `created_at` (timestamptz)
    
    - `events`
      - `id` (uuid, primary key)
      - `student_id` (uuid, references students)
      - `day_of_week` (integer, 1-5 for Monday-Friday)
      - `start_time` (text, format HH:MM)
      - `end_time` (text, format HH:MM)
      - `type` (text, enum: ULIS, CLASSE, PRISE_EN_CHARGE)
      - `aesh` (boolean, default false)
      - `label` (text)
      - `location` (text, optional)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage only their own data
    - Each table has user_id checks for data isolation
*/

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_time text DEFAULT '08:30' NOT NULL,
  end_time text DEFAULT '16:30' NOT NULL,
  time_step integer DEFAULT 30 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- Create periods table
CREATE TABLE IF NOT EXISTS periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL CHECK (name IN ('P1', 'P2', 'P3', 'P4', 'P5')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, name)
);

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_id uuid REFERENCES periods(id) ON DELETE CASCADE NOT NULL,
  first_name text NOT NULL,
  last_name text DEFAULT '' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 5),
  start_time text NOT NULL,
  end_time text NOT NULL,
  type text NOT NULL CHECK (type IN ('ULIS', 'CLASSE', 'PRISE_EN_CHARGE')),
  aesh boolean DEFAULT false NOT NULL,
  label text DEFAULT '' NOT NULL,
  location text DEFAULT '' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for periods
CREATE POLICY "Users can view own periods"
  ON periods FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own periods"
  ON periods FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own periods"
  ON periods FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own periods"
  ON periods FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for students
CREATE POLICY "Users can view own students"
  ON students FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own students"
  ON students FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own students"
  ON students FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for events
CREATE POLICY "Users can view own events"
  ON events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = events.student_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = events.student_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = events.student_id
      AND students.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = events.student_id
      AND students.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM students
      WHERE students.id = events.student_id
      AND students.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_periods_user_id ON periods(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_period_id ON students(period_id);
CREATE INDEX IF NOT EXISTS idx_events_student_id ON events(student_id);