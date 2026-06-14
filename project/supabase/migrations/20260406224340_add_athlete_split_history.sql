/*
  # Add Athlete Split History Tracking

  ## Overview
  Enhances the database schema to support comprehensive athlete performance tracking across all workouts.

  ## Changes Made

  ### 1. New Table: `athlete_splits`
  - `id` (uuid, primary key) - Unique identifier
  - `athlete_name` (text, indexed) - Name of the athlete
  - `split_id` (uuid) - References splits table
  - `session_id` (uuid) - References sessions table
  - `workout_id` (uuid) - References workouts table
  - `user_id` (uuid) - Coach/user who recorded this
  - `rep_number` (integer) - Which rep this was in the workout
  - `time_ms` (integer) - Split time in milliseconds
  - `distance` (text) - Distance run (e.g., "100m")
  - `group_number` (integer, nullable) - Group assignment
  - `recorded_at` (timestamptz) - When this split was recorded
  - `created_at` (timestamptz) - Row creation timestamp

  ### 2. Indexes
  - Index on athlete_name for fast athlete lookups
  - Index on user_id for coach-specific queries
  - Composite index on (athlete_name, user_id, recorded_at) for history queries

  ## Security
  - Enable RLS on athlete_splits table
  - Users can view their own athlete data
  - Anonymous users can view athlete data from their sessions
  - Users can insert/update athlete splits for their sessions

  ## Important Notes
  - This table serves as a complete historical record of all athlete performances
  - Allows coaches to view all previous splits for any athlete
  - Supports Excel export functionality for comprehensive reporting
*/

-- Create athlete_splits table for complete history tracking
CREATE TABLE IF NOT EXISTS athlete_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_name text NOT NULL,
  split_id uuid REFERENCES splits(id) ON DELETE CASCADE NOT NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  rep_number integer NOT NULL,
  time_ms integer NOT NULL,
  distance text NOT NULL,
  group_number integer,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS athlete_splits_athlete_name_idx ON athlete_splits(athlete_name);
CREATE INDEX IF NOT EXISTS athlete_splits_user_id_idx ON athlete_splits(user_id);
CREATE INDEX IF NOT EXISTS athlete_splits_session_id_idx ON athlete_splits(session_id);
CREATE INDEX IF NOT EXISTS athlete_splits_workout_id_idx ON athlete_splits(workout_id);
CREATE INDEX IF NOT EXISTS athlete_splits_history_idx ON athlete_splits(athlete_name, user_id, recorded_at DESC);

-- Enable Row Level Security
ALTER TABLE athlete_splits ENABLE ROW LEVEL SECURITY;

-- Users can view their own athlete splits
CREATE POLICY "Users can view own athlete splits"
  ON athlete_splits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Anonymous users can view athlete splits from their sessions
CREATE POLICY "Anonymous users can view athlete splits from their sessions"
  ON athlete_splits FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = athlete_splits.session_id
      AND sessions.user_id IS NULL
    )
  );

-- Users can insert athlete splits for their sessions
CREATE POLICY "Users can create athlete splits in own sessions"
  ON athlete_splits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Anonymous users can insert athlete splits for their sessions
CREATE POLICY "Anonymous users can create athlete splits"
  ON athlete_splits FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = athlete_splits.session_id
      AND sessions.user_id IS NULL
    )
  );

-- Users can update their own athlete splits
CREATE POLICY "Users can update own athlete splits"
  ON athlete_splits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anonymous users can update athlete splits from their sessions
CREATE POLICY "Anonymous users can update athlete splits"
  ON athlete_splits FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = athlete_splits.session_id
      AND sessions.user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = athlete_splits.session_id
      AND sessions.user_id IS NULL
    )
  );

-- Function to automatically create athlete_split records when splits are assigned athlete names
CREATE OR REPLACE FUNCTION create_athlete_split_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create athlete_split if athlete_name is being set or updated
  IF NEW.athlete_name IS NOT NULL AND (OLD.athlete_name IS NULL OR OLD.athlete_name != NEW.athlete_name) THEN
    -- Get workout details from the session
    INSERT INTO athlete_splits (
      athlete_name,
      split_id,
      session_id,
      workout_id,
      user_id,
      rep_number,
      time_ms,
      distance,
      group_number,
      recorded_at
    )
    SELECT
      NEW.athlete_name,
      NEW.id,
      NEW.session_id,
      s.workout_id,
      s.user_id,
      NEW.rep_number,
      NEW.time_ms,
      w.distance,
      NEW.group_number,
      NEW.timestamp
    FROM sessions s
    JOIN workouts w ON w.id = s.workout_id
    WHERE s.id = NEW.session_id
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically populate athlete_splits
DROP TRIGGER IF EXISTS splits_athlete_assignment_trigger ON splits;
CREATE TRIGGER splits_athlete_assignment_trigger
  AFTER UPDATE OF athlete_name ON splits
  FOR EACH ROW
  EXECUTE FUNCTION create_athlete_split_on_update();
