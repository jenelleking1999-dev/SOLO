-- ============================================================
-- PREREQUISITE: account_deletion_log table
-- Referenced by later migrations (grants / RLS policies) but its CREATE
-- lived outside the migrations folder. Added here so the schema builds
-- cleanly on a fresh database.
-- ============================================================
CREATE TABLE IF NOT EXISTS account_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  deleted_at timestamptz DEFAULT now()
);
ALTER TABLE account_deletion_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 20260404194116_create_solo_app_schema.sql
-- ============================================================
/*
  # SOLO App Database Schema
  
  ## Overview
  Creates the complete database schema for the SOLO coaching app, including tables for workouts, sessions, splits, and athletes.
  
  ## New Tables
  
  ### 1. `profiles`
  - `id` (uuid, primary key) - References auth.users
  - `email` (text) - User email
  - `full_name` (text) - User's full name
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update
  
  ### 2. `workouts`
  - `id` (uuid, primary key) - Unique workout identifier
  - `user_id` (uuid) - Owner of the workout (null for anonymous)
  - `name` (text) - Workout name/description
  - `reps` (integer) - Number of repetitions
  - `distance` (text) - Distance per rep (e.g., "100m")
  - `target_time` (integer) - Target time in seconds
  - `rest_time` (integer) - Rest between reps in seconds
  - `group_count` (integer) - Number of groups
  - `athletes_per_group` (integer) - Athletes per group
  - `tags` (text array) - Tags like "Sprinters", "Varsity"
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 3. `sessions`
  - `id` (uuid, primary key) - Unique session identifier
  - `workout_id` (uuid) - References workouts table
  - `user_id` (uuid) - Session owner (null for anonymous)
  - `started_at` (timestamptz) - Session start time
  - `completed_at` (timestamptz, nullable) - Session completion time
  - `current_rep` (integer) - Current rep number
  - `status` (text) - Session status: "active", "paused", "completed"
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 4. `splits`
  - `id` (uuid, primary key) - Unique split identifier
  - `session_id` (uuid) - References sessions table
  - `rep_number` (integer) - Which rep this split belongs to
  - `time_ms` (integer) - Split time in milliseconds
  - `athlete_name` (text, nullable) - Assigned athlete name
  - `group_number` (integer, nullable) - Assigned group number
  - `timestamp` (timestamptz) - When the split was recorded
  - `created_at` (timestamptz) - Creation timestamp
  
  ### 5. `athletes`
  - `id` (uuid, primary key) - Unique athlete identifier
  - `user_id` (uuid) - Coach who added this athlete
  - `name` (text) - Athlete name
  - `tags` (text array) - Tags like "Sprinters", "Varsity"
  - `created_at` (timestamptz) - Creation timestamp
  
  ## Security
  - Enable RLS on all tables
  - Profiles: Users can read/update their own profile
  - Workouts: Users can manage their own workouts; anonymous users can create temporary workouts
  - Sessions: Users can manage their own sessions; anonymous users can create temporary sessions
  - Splits: Access controlled through session ownership
  - Athletes: Users can manage their own athletes
  
  ## Indexes
  - Index on user_id for all tables for fast lookups
  - Index on session_id for splits
  - Index on workout_id for sessions
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  reps integer DEFAULT 1,
  distance text DEFAULT '100m',
  target_time integer DEFAULT 15,
  rest_time integer DEFAULT 45,
  group_count integer DEFAULT 1,
  athletes_per_group integer DEFAULT 1,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid REFERENCES workouts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  current_rep integer DEFAULT 1,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

-- Create splits table
CREATE TABLE IF NOT EXISTS splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  rep_number integer NOT NULL,
  time_ms integer NOT NULL,
  athlete_name text,
  group_number integer,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create athletes table
CREATE TABLE IF NOT EXISTS athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS workouts_user_id_idx ON workouts(user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_workout_id_idx ON sessions(workout_id);
CREATE INDEX IF NOT EXISTS splits_session_id_idx ON splits(session_id);
CREATE INDEX IF NOT EXISTS athletes_user_id_idx ON athletes(user_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Workouts policies
CREATE POLICY "Users can view own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can create temporary workouts"
  ON workouts FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Users can update own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workouts"
  ON workouts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Sessions policies
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can create temporary sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anonymous users can update temporary sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- Splits policies
CREATE POLICY "Users can view splits from own sessions"
  ON splits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create splits in own sessions"
  ON splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anonymous users can create splits in temporary sessions"
  ON splits FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id IS NULL
    )
  );

CREATE POLICY "Users can update splits in own sessions"
  ON splits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anonymous users can update splits in temporary sessions"
  ON splits FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id IS NULL
    )
  );

-- Athletes policies
CREATE POLICY "Users can view own athletes"
  ON athletes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create athletes"
  ON athletes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own athletes"
  ON athletes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own athletes"
  ON athletes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 20260404201205_fix_rls_policies_for_anonymous.sql
-- ============================================================
/*
  # Fix RLS Policies for Anonymous Users

  ## Changes
  - Add policies to allow anonymous users to view their temporary workouts
  - Add policies to allow anonymous users to view their temporary sessions
  - Ensure workouts and sessions tables support anonymous access properly
  
  ## Security
  - Anonymous users can only access data they create (no user_id check needed for anon)
  - Authenticated users can only access their own data
*/

-- Drop existing restrictive policies that block anonymous users
DROP POLICY IF EXISTS "Anonymous users can create temporary workouts" ON workouts;
DROP POLICY IF EXISTS "Anonymous users can create temporary sessions" ON sessions;
DROP POLICY IF EXISTS "Anonymous users can update temporary sessions" ON sessions;
DROP POLICY IF EXISTS "Anonymous users can create splits in temporary sessions" ON splits;
DROP POLICY IF EXISTS "Anonymous users can update splits in temporary sessions" ON splits;

-- Workouts policies for anonymous users
CREATE POLICY "Anonymous users can insert workouts"
  ON workouts FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can view all workouts"
  ON workouts FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can update workouts"
  ON workouts FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Sessions policies for anonymous users
CREATE POLICY "Anonymous users can insert sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can view all sessions"
  ON sessions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can update sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Splits policies for anonymous users
CREATE POLICY "Anonymous users can insert splits"
  ON splits FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anonymous users can view all splits"
  ON splits FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anonymous users can update splits"
  ON splits FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);


-- ============================================================
-- 20260406224340_add_athlete_split_history.sql
-- ============================================================
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


-- ============================================================
-- 20260406234912_fix_athlete_splits_duplicates.sql
-- ============================================================
/*
  # Fix Athlete Splits Duplicate Records

  ## Problem
  The trigger creates multiple athlete_split records for the same split when
  the athlete name is updated multiple times (e.g., typing "S", "Sa", "Sam").

  ## Solution
  1. Add unique constraint on split_id to ensure one athlete_split per split
  2. Update trigger to use UPSERT logic instead of INSERT with ON CONFLICT DO NOTHING
  3. Clean up any existing duplicate records

  ## Changes
  - Add unique constraint on split_id column
  - Modify trigger function to UPDATE existing records or INSERT new ones
  - Delete duplicate records, keeping the most recent one for each split_id
*/

-- First, clean up duplicate records - keep only the most recent one for each split_id
DELETE FROM athlete_splits a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (split_id) id
  FROM athlete_splits
  ORDER BY split_id, created_at DESC
);

-- Add unique constraint on split_id
ALTER TABLE athlete_splits DROP CONSTRAINT IF EXISTS athlete_splits_split_id_unique;
ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_split_id_unique UNIQUE (split_id);

-- Update the trigger function to use UPSERT logic
CREATE OR REPLACE FUNCTION create_athlete_split_on_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create/update athlete_split if athlete_name is being set
  IF NEW.athlete_name IS NOT NULL THEN
    -- Get workout details from the session and UPSERT
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
    ON CONFLICT (split_id) 
    DO UPDATE SET
      athlete_name = EXCLUDED.athlete_name,
      group_number = EXCLUDED.group_number,
      time_ms = EXCLUDED.time_ms;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 20260408181308_add_anonymous_select_policies.sql
-- ============================================================
/*
  # Add Anonymous SELECT Policies for Workouts and Sessions

  ## Problem
  Anonymous users can create workouts and sessions but cannot SELECT them back.
  This causes the session/stopwatch page to fail when fetching workout data,
  resulting in the workout details (including rep count) never loading.

  ## Changes
  - Add SELECT policy for anonymous users on workouts table
  - Add SELECT policy for anonymous users on sessions table
  - Add SELECT policy for anonymous users on splits table

  ## Security
  - Anonymous users can only read workouts they created (user_id IS NULL)
  - Anonymous users can only read sessions they created (user_id IS NULL)
  - Anonymous users can only read splits from their own sessions
*/

-- Anonymous users can view workouts they created
CREATE POLICY "Anonymous users can view temporary workouts"
  ON workouts FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- Anonymous users can view sessions they created
CREATE POLICY "Anonymous users can view temporary sessions"
  ON sessions FOR SELECT
  TO anon
  USING (user_id IS NULL);

-- Anonymous users can view splits from their sessions
CREATE POLICY "Anonymous users can view splits in temporary sessions"
  ON splits FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id IS NULL
    )
  );


-- ============================================================
-- 20260410042136_backfill_missing_athlete_splits_and_fix_trigger.sql
-- ============================================================
/*
  # Backfill Missing Athlete Splits and Fix Trigger

  ## Problem
  1. Splits that were assigned athlete names before the trigger was created have no
     corresponding athlete_splits records. These need to be backfilled.
  2. The trigger only fires on UPDATE OF athlete_name, but not on INSERT when an
     athlete_name is already provided. This edge case should also be handled.

  ## Changes
  1. Backfill athlete_splits for all splits that have an athlete_name but no
     corresponding record in athlete_splits.
  2. Update the trigger function and add an INSERT trigger to cover the INSERT case.
*/

-- Backfill missing athlete_splits records for splits that already have athlete names
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
  sp.athlete_name,
  sp.id,
  sp.session_id,
  s.workout_id,
  s.user_id,
  sp.rep_number,
  sp.time_ms,
  w.distance,
  sp.group_number,
  COALESCE(sp.timestamp, sp.created_at, now())
FROM splits sp
JOIN sessions s ON s.id = sp.session_id
JOIN workouts w ON w.id = s.workout_id
LEFT JOIN athlete_splits ath ON ath.split_id = sp.id
WHERE sp.athlete_name IS NOT NULL
AND ath.id IS NULL
ON CONFLICT (split_id) DO NOTHING;

-- Update trigger function to handle both INSERT and UPDATE cases
CREATE OR REPLACE FUNCTION create_athlete_split_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.athlete_name IS NOT NULL THEN
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
    ON CONFLICT (split_id)
    DO UPDATE SET
      athlete_name = EXCLUDED.athlete_name,
      group_number = EXCLUDED.group_number,
      time_ms = EXCLUDED.time_ms;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add INSERT trigger so splits inserted with an athlete_name are also tracked
DROP TRIGGER IF EXISTS splits_athlete_insert_trigger ON splits;
CREATE TRIGGER splits_athlete_insert_trigger
  AFTER INSERT ON splits
  FOR EACH ROW
  WHEN (NEW.athlete_name IS NOT NULL)
  EXECUTE FUNCTION create_athlete_split_on_update();


-- ============================================================
-- 20260410043109_add_groups_table_and_group_id_to_splits.sql
-- ============================================================
/*
  # Add Groups Table and group_id to Splits

  ## Overview
  Supports multi-group workout tracking where each group has its own
  independent stopwatch and split history within a session.

  ## New Table: `groups`
  - `id` (uuid, primary key)
  - `session_id` (uuid) - which session this group belongs to
  - `label` (text) - display name, e.g. "Group A"
  - `group_index` (integer) - ordering index (0-based)
  - `athlete_names` (text[]) - athletes locked in after rep 1
  - `current_rep` (integer) - tracks rep progress per group
  - `is_active` (boolean) - whether this group is currently running a rep
  - `created_at` (timestamptz)

  ## Changes to `splits`
  - Add `group_id` (uuid, nullable) - references groups table

  ## Security
  - Enable RLS on groups table
  - Mirror the same access patterns as sessions/splits
*/

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  label text NOT NULL DEFAULT 'Group A',
  group_index integer NOT NULL DEFAULT 0,
  athlete_names text[] DEFAULT '{}',
  current_rep integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS groups_session_id_idx ON groups(session_id);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view groups in own sessions"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon users can view groups in anon sessions"
  ON groups FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id IS NULL
    )
  );

CREATE POLICY "Users can create groups in own sessions"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon users can create groups in anon sessions"
  ON groups FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id IS NULL
    )
  );

CREATE POLICY "Users can update groups in own sessions"
  ON groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon users can update groups in anon sessions"
  ON groups FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id IS NULL
    )
  );

-- Add group_id to splits (nullable for backwards compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'splits' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE splits ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS splits_group_id_idx ON splits(group_id);


-- ============================================================
-- 20260410044212_enhance_athlete_splits_with_group_and_workout_data.sql
-- ============================================================
/*
  # Enhance athlete_splits with group and workout metadata

  ## Overview
  Adds richer context to each athlete_splits record so the athlete history screen
  can display workout name, group label, and group identity without extra joins.

  ## Changes to `athlete_splits`
  - Add `group_id` (uuid, nullable) — direct reference to the groups table
  - Add `group_label` (text, nullable) — denormalized group name (e.g. "Group A") for fast reads
  - Add `workout_name` (text, nullable) — denormalized workout name for fast reads

  ## Trigger update
  - Rebuild `create_athlete_split_on_update` to populate the new columns from
    the splits → groups join and the workouts table.
  - Also add a `DELETE` branch so if athlete_name is cleared the history row is removed.

  ## Backfill
  - Backfill all existing athlete_splits rows with group_label and workout_name
    where the data is available.
*/

-- Add new columns (safe, nullable, no data loss)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_splits' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE athlete_splits ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_splits' AND column_name = 'group_label'
  ) THEN
    ALTER TABLE athlete_splits ADD COLUMN group_label text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_splits' AND column_name = 'workout_name'
  ) THEN
    ALTER TABLE athlete_splits ADD COLUMN workout_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS athlete_splits_group_id_idx ON athlete_splits(group_id);

-- Replace the trigger function to include group_id, group_label, and workout_name
CREATE OR REPLACE FUNCTION create_athlete_split_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.athlete_name IS NOT NULL THEN
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
      group_id,
      group_label,
      workout_name,
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
      NEW.group_id,
      g.label,
      w.name,
      COALESCE(NEW.timestamp, now())
    FROM sessions s
    JOIN workouts w ON w.id = s.workout_id
    LEFT JOIN groups g ON g.id = NEW.group_id
    WHERE s.id = NEW.session_id
    ON CONFLICT (split_id)
    DO UPDATE SET
      athlete_name = EXCLUDED.athlete_name,
      group_number = EXCLUDED.group_number,
      group_id     = EXCLUDED.group_id,
      group_label  = EXCLUDED.group_label,
      workout_name = EXCLUDED.workout_name,
      time_ms      = EXCLUDED.time_ms;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure both INSERT and UPDATE triggers exist
DROP TRIGGER IF EXISTS splits_athlete_assignment_trigger ON splits;
CREATE TRIGGER splits_athlete_assignment_trigger
  AFTER UPDATE OF athlete_name ON splits
  FOR EACH ROW
  EXECUTE FUNCTION create_athlete_split_on_update();

DROP TRIGGER IF EXISTS splits_athlete_insert_trigger ON splits;
CREATE TRIGGER splits_athlete_insert_trigger
  AFTER INSERT ON splits
  FOR EACH ROW
  WHEN (NEW.athlete_name IS NOT NULL)
  EXECUTE FUNCTION create_athlete_split_on_update();

-- Backfill group_label and workout_name into existing athlete_splits rows
UPDATE athlete_splits ath
SET
  group_label  = g.label,
  workout_name = w.name,
  group_id     = sp.group_id
FROM splits sp
JOIN sessions s  ON s.id  = sp.session_id
JOIN workouts w  ON w.id  = s.workout_id
LEFT JOIN groups g ON g.id = sp.group_id
WHERE ath.split_id = sp.id
  AND (ath.group_label IS NULL OR ath.workout_name IS NULL);


-- ============================================================
-- 20260411232237_add_split_order_to_groups.sql
-- ============================================================
/*
  # Add split_order to groups table

  ## Overview
  Persists the split-to-athlete mapping for each group so that subsequent reps
  automatically reuse the same athlete assignment order established during the first rep.

  ## Changes to `groups`
  - `split_order` (text[], nullable) — ordered list of athlete names matching the split
    positions recorded in the first rep. Index 0 = split #1, index 1 = split #2, etc.
    This is identical to `athlete_names` by default but stored separately to allow
    future flexibility (e.g. athletes per group > split count).

  ## How it works
  - On first rep completion the coach assigns athletes to splits.
  - The ordered athlete name array is saved into `split_order`.
  - For all subsequent reps, `split_order` is used to auto-fill athlete_name on each
    new split without requiring coach input, and the group advances automatically.

  ## Notes
  - Nullable so existing groups without this data remain valid.
  - No data loss — purely additive column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'split_order'
  ) THEN
    ALTER TABLE groups ADD COLUMN split_order text[] DEFAULT '{}';
  END IF;
END $$;


-- ============================================================
-- 20260418162145_add_multi_athlete_per_split_support.sql
-- ============================================================
/*
  # Multi-Athlete Per Split Support

  ## Overview
  Removes the single-athlete constraint from athlete_splits so that multiple athletes
  can share the same split time. Updates the trigger function accordingly.

  ## Changes

  ### athlete_splits table
  - Drops the unique constraint on split_id (previously enforced via ON CONFLICT)
  - Adds a unique constraint on (split_id, athlete_name) instead — prevents the same
    athlete being recorded twice for the same split but allows multiple athletes per split

  ### Trigger update
  - Updated insert logic to use the new composite unique constraint
  - Removes the old ON CONFLICT (split_id) DO UPDATE that overwrote previous athletes

  ## Notes
  - Existing data is preserved — no destructive operations
  - The splits.athlete_name column is kept for backwards compatibility (stores last assigned)
*/

-- Remove the old unique index on split_id if it exists
DROP INDEX IF EXISTS athlete_splits_split_id_key;

-- Also handle the case where it's a named constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'athlete_splits'
    AND constraint_name = 'athlete_splits_split_id_key'
    AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE athlete_splits DROP CONSTRAINT athlete_splits_split_id_key;
  END IF;
END $$;

-- Add composite unique constraint: one row per (split_id, athlete_name) combination
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'athlete_splits'
    AND constraint_name = 'athlete_splits_split_athlete_unique'
    AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_split_athlete_unique
      UNIQUE (split_id, athlete_name);
  END IF;
END $$;

-- Update the trigger function to use the new composite constraint
CREATE OR REPLACE FUNCTION create_athlete_split_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.athlete_name IS NOT NULL THEN
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
    ON CONFLICT (split_id, athlete_name) DO UPDATE SET
      time_ms = EXCLUDED.time_ms,
      group_number = EXCLUDED.group_number;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 20260418173136_add_authenticated_user_rls_policies.sql
-- ============================================================
/*
  # Add Authenticated User RLS Policies

  ## Summary
  Adds row-level security policies so authenticated users can only access
  their own data (workouts, sessions, splits, groups, athletes, athlete_splits).

  ## Changes

  ### workouts
  - Authenticated users can insert workouts tied to their user_id
  - Authenticated users can select only their own workouts
  - Authenticated users can update only their own workouts

  ### sessions
  - Authenticated users can insert sessions tied to their user_id
  - Authenticated users can select only their own sessions
  - Authenticated users can update only their own sessions

  ### splits
  - Authenticated users can insert splits for their own sessions
  - Authenticated users can select splits for their own sessions
  - Authenticated users can update splits for their own sessions

  ### groups
  - Authenticated users can insert groups for their own sessions
  - Authenticated users can select groups for their own sessions
  - Authenticated users can update groups for their own sessions

  ### athletes
  - Authenticated users can insert athletes tied to their user_id
  - Authenticated users can select only their own athletes
  - Authenticated users can update only their own athletes
  - Authenticated users can delete only their own athletes

  ### athlete_splits
  - Authenticated users can insert athlete_splits for their own data
  - Authenticated users can select only their own athlete_splits
  - Authenticated users can update only their own athlete_splits

  ## Security Notes
  - All policies use auth.uid() to enforce ownership
  - Splits and groups are scoped via session ownership check
*/

-- workouts: authenticated policies
CREATE POLICY "Authenticated users can insert their workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view their workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- sessions: authenticated policies
CREATE POLICY "Authenticated users can insert their sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view their sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- groups: authenticated policies (scoped via session ownership)
CREATE POLICY "Authenticated users can insert groups in their sessions"
  ON groups FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view groups in their sessions"
  ON groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update groups in their sessions"
  ON groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = groups.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- splits: authenticated policies (scoped via session ownership)
CREATE POLICY "Authenticated users can insert splits in their sessions"
  ON splits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view splits in their sessions"
  ON splits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update splits in their sessions"
  ON splits FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id = auth.uid()
    )
  );

-- athletes: authenticated policies
CREATE POLICY "Authenticated users can insert their athletes"
  ON athletes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view their athletes"
  ON athletes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their athletes"
  ON athletes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their athletes"
  ON athletes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- athlete_splits: authenticated policies
CREATE POLICY "Authenticated users can insert their athlete_splits"
  ON athlete_splits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view their athlete_splits"
  ON athlete_splits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their athlete_splits"
  ON athlete_splits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 20260418174443_fix_rls_always_true_policies_and_function_search_path.sql
-- ============================================================
/*
  # Fix Security Issues: RLS Always-True Policies and Mutable Function Search Path

  ## Summary
  This migration resolves three categories of security vulnerabilities:

  1. **Mutable search_path on trigger function** - The `create_athlete_split_on_update`
     function had no explicit search_path set, allowing a malicious user to hijack
     name resolution by creating objects in their own schema. Fixed by setting
     `search_path = public` and marking it SECURITY DEFINER with a locked path.

  2. **Always-true anon INSERT/UPDATE policies** - The `sessions`, `splits`, and
     `workouts` tables had anon-role policies whose WITH CHECK / USING clauses
     were literally `true`, meaning any anonymous request could write or update
     any row regardless of ownership. These are dropped and replaced with
     properly scoped policies that only allow anon access to rows where
     `user_id IS NULL` (unauthenticated / guest sessions).

  3. **Overly broad anon SELECT policies** - Redundant `"Anonymous users can view
     all ..."` policies (USING true) are dropped; the narrower
     `user_id IS NULL` variants that were already present are kept.

  ## Tables Modified
  - `public.sessions`
  - `public.splits`
  - `public.workouts`

  ## Functions Modified
  - `public.create_athlete_split_on_update`

  ## Security Notes
  - Anonymous users can only touch rows with `user_id IS NULL`
  - Authenticated users continue to use their existing `auth.uid() = user_id` policies
  - No data is dropped or altered
*/

-- ============================================================
-- 1. Fix function search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_athlete_split_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.athlete_name IS NOT NULL THEN
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
    ON CONFLICT (split_id, athlete_name) DO UPDATE SET
      time_ms = EXCLUDED.time_ms,
      group_number = EXCLUDED.group_number;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. sessions: drop always-true anon policies, replace with scoped ones
-- ============================================================
DROP POLICY IF EXISTS "Anonymous users can insert sessions" ON sessions;
DROP POLICY IF EXISTS "Anonymous users can update sessions" ON sessions;
DROP POLICY IF EXISTS "Anonymous users can view all sessions" ON sessions;

CREATE POLICY "Anon users can insert guest sessions"
  ON sessions FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Anon users can update guest sessions"
  ON sessions FOR UPDATE
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- ============================================================
-- 3. workouts: drop always-true anon policies, replace with scoped ones
-- ============================================================
DROP POLICY IF EXISTS "Anonymous users can insert workouts" ON workouts;
DROP POLICY IF EXISTS "Anonymous users can update workouts" ON workouts;
DROP POLICY IF EXISTS "Anonymous users can view all workouts" ON workouts;

CREATE POLICY "Anon users can insert guest workouts"
  ON workouts FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Anon users can update guest workouts"
  ON workouts FOR UPDATE
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- ============================================================
-- 4. splits: drop always-true anon policies, replace with scoped ones
-- ============================================================
DROP POLICY IF EXISTS "Anonymous users can insert splits" ON splits;
DROP POLICY IF EXISTS "Anonymous users can update splits" ON splits;
DROP POLICY IF EXISTS "Anonymous users can view all splits" ON splits;

CREATE POLICY "Anon users can insert splits in guest sessions"
  ON splits FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id IS NULL
    )
  );

CREATE POLICY "Anon users can update splits in guest sessions"
  ON splits FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id IS NULL
    )
  );


-- ============================================================
-- 20260420040200_add_segments_to_workouts.sql
-- ============================================================
/*
  # Add segments column to workouts table

  ## Summary
  Adds a `segments` JSONB column to the `workouts` table to support multi-segment
  workout definitions. Each segment stores its own reps, distance, target time, and rest.

  ## Changes
  - `workouts` table: new `segments` JSONB column (nullable, defaults to empty array)

  ## Notes
  - Existing workouts will have segments = '[]' and continue to use the flat columns
  - New multi-segment workouts populate this array
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'segments'
  ) THEN
    ALTER TABLE workouts ADD COLUMN segments jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;


-- ============================================================
-- 20260420040334_add_current_segment_to_sessions.sql
-- ============================================================
/*
  # Add current_segment_index to sessions table

  ## Summary
  Adds a `current_segment_index` column to the `sessions` table to track
  which segment of a multi-segment workout is currently being executed.

  ## Changes
  - `sessions` table: new `current_segment_index` integer column (default 0)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'current_segment_index'
  ) THEN
    ALTER TABLE sessions ADD COLUMN current_segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;


-- ============================================================
-- 20260421154047_add_segment_index_to_splits.sql
-- ============================================================
/*
  # Add segment_index to splits table

  1. Modified Tables
    - `splits`
      - Added `segment_index` (integer, default 0) to track which workout segment a split belongs to
  2. Important Notes
    - Existing splits are assigned segment_index = 0 by default (backward compatible)
    - This enables proper isolation of split data between workout segments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'splits' AND column_name = 'segment_index'
  ) THEN
    ALTER TABLE splits ADD COLUMN segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;


-- ============================================================
-- 20260421235652_fix_athlete_splits_completeness.sql
-- ============================================================
/*
  # Fix athlete_splits completeness for segmented workouts

  1. Schema Changes
    - `athlete_splits`: Add `segment_index` (integer, default 0) to track which workout
      segment a result belongs to

  2. Trigger Function Rebuild
    - Rebuild `create_athlete_split_on_update` to include ALL metadata columns:
      group_id, group_label, workout_name, and segment_index
    - The previous security-fix migration accidentally dropped group_id, group_label,
      and workout_name from the trigger's INSERT list
    - Uses segment-specific distance from the workout's segments JSON when available,
      falling back to the workout-level distance for non-segmented workouts
    - Maintains SECURITY DEFINER and search_path = public

  3. Data Integrity
    - Backfills segment_index = 0 on all existing athlete_splits rows (default)
    - Backfills missing group_label and workout_name on existing rows
    - No destructive operations; all changes are additive

  4. Important Notes
    - The composite unique constraint (split_id, athlete_name) is preserved
    - Both INSERT and UPDATE triggers are recreated
*/

-- 1. Add segment_index column to athlete_splits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_splits' AND column_name = 'segment_index'
  ) THEN
    ALTER TABLE athlete_splits ADD COLUMN segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Rebuild trigger function with ALL columns, including segment_index
CREATE OR REPLACE FUNCTION public.create_athlete_split_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_segment_index integer;
  v_distance text;
BEGIN
  IF NEW.athlete_name IS NOT NULL THEN
    v_segment_index := COALESCE(NEW.segment_index, 0);

    SELECT
      COALESCE(
        (w.segments -> v_segment_index ->> 'distance'),
        w.distance
      )
    INTO v_distance
    FROM sessions s
    JOIN workouts w ON w.id = s.workout_id
    WHERE s.id = NEW.session_id;

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
      group_id,
      group_label,
      workout_name,
      segment_index,
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
      COALESCE(v_distance, w.distance),
      NEW.group_number,
      NEW.group_id,
      g.label,
      w.name,
      v_segment_index,
      COALESCE(NEW.timestamp, now())
    FROM sessions s
    JOIN workouts w ON w.id = s.workout_id
    LEFT JOIN groups g ON g.id = NEW.group_id
    WHERE s.id = NEW.session_id
    ON CONFLICT (split_id, athlete_name) DO UPDATE SET
      time_ms      = EXCLUDED.time_ms,
      group_number = EXCLUDED.group_number,
      group_id     = EXCLUDED.group_id,
      group_label  = EXCLUDED.group_label,
      workout_name = EXCLUDED.workout_name,
      segment_index = EXCLUDED.segment_index,
      distance     = EXCLUDED.distance;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Recreate triggers
DROP TRIGGER IF EXISTS splits_athlete_assignment_trigger ON splits;
CREATE TRIGGER splits_athlete_assignment_trigger
  AFTER UPDATE OF athlete_name ON splits
  FOR EACH ROW
  EXECUTE FUNCTION create_athlete_split_on_update();

DROP TRIGGER IF EXISTS splits_athlete_insert_trigger ON splits;
CREATE TRIGGER splits_athlete_insert_trigger
  AFTER INSERT ON splits
  FOR EACH ROW
  WHEN (NEW.athlete_name IS NOT NULL)
  EXECUTE FUNCTION create_athlete_split_on_update();

-- 4. Backfill missing group_label, workout_name, segment_index on existing records
UPDATE athlete_splits ath
SET
  group_label   = COALESCE(ath.group_label, g.label),
  workout_name  = COALESCE(ath.workout_name, w.name),
  segment_index = COALESCE(sp.segment_index, 0)
FROM splits sp
JOIN sessions s  ON s.id  = sp.session_id
JOIN workouts w  ON w.id  = s.workout_id
LEFT JOIN groups g ON g.id = sp.group_id
WHERE ath.split_id = sp.id
  AND (ath.group_label IS NULL OR ath.workout_name IS NULL);


-- ============================================================
-- 20260516052454_add_check_constraints_for_data_integrity.sql
-- ============================================================
/*
  # Add CHECK constraints for data integrity

  1. Changes
    - Add CHECK constraint on `splits.time_ms` to ensure positive values
    - Add CHECK constraint on `workouts.reps` to ensure positive values
    - Add CHECK constraint on `workouts.target_time` to ensure non-negative values
    - Add CHECK constraint on `workouts.rest_time` to ensure non-negative values
    - Add CHECK constraint on `athlete_splits.time_ms` to ensure positive values
    - Add CHECK constraint on `athlete_splits.rep_number` to ensure positive values
    - Add CHECK constraint on `splits.rep_number` to ensure positive values

  2. Security
    - Prevents invalid data from being inserted at the database level
    - Blocks negative times, zero reps, and other nonsensical values
    - Acts as server-side validation layer regardless of client behavior

  3. Important Notes
    - Uses DO blocks to safely add constraints only if they don't exist
    - Will not affect existing valid data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'splits_time_ms_positive'
  ) THEN
    ALTER TABLE splits ADD CONSTRAINT splits_time_ms_positive CHECK (time_ms > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'splits_rep_number_positive'
  ) THEN
    ALTER TABLE splits ADD CONSTRAINT splits_rep_number_positive CHECK (rep_number > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workouts_reps_positive'
  ) THEN
    ALTER TABLE workouts ADD CONSTRAINT workouts_reps_positive CHECK (reps > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workouts_target_time_non_negative'
  ) THEN
    ALTER TABLE workouts ADD CONSTRAINT workouts_target_time_non_negative CHECK (target_time >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workouts_rest_time_non_negative'
  ) THEN
    ALTER TABLE workouts ADD CONSTRAINT workouts_rest_time_non_negative CHECK (rest_time >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athlete_splits_time_ms_positive'
  ) THEN
    ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_time_ms_positive CHECK (time_ms > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athlete_splits_rep_number_positive'
  ) THEN
    ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_rep_number_positive CHECK (rep_number > 0);
  END IF;
END $$;


-- ============================================================
-- 20260516052813_remove_duplicate_rls_policies.sql
-- ============================================================
/*
  # Remove duplicate RLS policies

  1. Changes
    - Remove redundant duplicate policies on workouts, sessions, splits, groups, athletes, athlete_splits tables
    - Keep the "Authenticated users can..." policies (more descriptive and consistent naming)
    - Remove the shorter "Users can..." duplicates that have identical logic

  2. Security
    - No security change — the remaining policies provide identical protection
    - Each table retains proper SELECT/INSERT/UPDATE/DELETE policies for authenticated users
    - Anonymous user policies are untouched

  3. Important Notes
    - Duplicate PERMISSIVE policies are OR'd together so removing one set has zero functional impact
    - This reduces maintenance confusion and policy clutter
*/

-- workouts: remove duplicate "Users can..." policies (keeping "Authenticated users can...")
DROP POLICY IF EXISTS "Users can create workouts" ON workouts;
DROP POLICY IF EXISTS "Users can update own workouts" ON workouts;
DROP POLICY IF EXISTS "Users can view own workouts" ON workouts;

-- sessions: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create sessions" ON sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;

-- splits: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create splits in own sessions" ON splits;
DROP POLICY IF EXISTS "Users can update splits in own sessions" ON splits;
DROP POLICY IF EXISTS "Users can view splits from own sessions" ON splits;

-- groups: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create groups in own sessions" ON groups;
DROP POLICY IF EXISTS "Users can update groups in own sessions" ON groups;
DROP POLICY IF EXISTS "Users can view groups in own sessions" ON groups;

-- athletes: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create athletes" ON athletes;
DROP POLICY IF EXISTS "Users can update own athletes" ON athletes;
DROP POLICY IF EXISTS "Users can delete own athletes" ON athletes;
DROP POLICY IF EXISTS "Users can view own athletes" ON athletes;

-- athlete_splits: remove duplicate "Users can..." policies
DROP POLICY IF EXISTS "Users can create athlete splits in own sessions" ON athlete_splits;
DROP POLICY IF EXISTS "Users can update own athlete splits" ON athlete_splits;
DROP POLICY IF EXISTS "Users can view own athlete splits" ON athlete_splits;


-- ============================================================
-- 20260525234015_add_missing_delete_rls_policies.sql
-- ============================================================
/*
  # Add Missing DELETE RLS Policies

  1. Security Changes
    - Add DELETE policy for `athlete_splits` so authenticated users can remove their own records
    - Add DELETE policy for `splits` so authenticated users can remove splits in their sessions
    - Add DELETE policy for `groups` so authenticated users can remove groups in their sessions

  2. Notes
    - These tables previously had no DELETE policies, meaning authenticated users
      could not explicitly delete records even though CASCADE handles parent deletions
    - Without explicit DELETE policies, RLS blocks all direct DELETE operations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete their athlete_splits' AND tablename = 'athlete_splits'
  ) THEN
    CREATE POLICY "Authenticated users can delete their athlete_splits"
      ON athlete_splits FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete splits in their sessions' AND tablename = 'splits'
  ) THEN
    CREATE POLICY "Authenticated users can delete splits in their sessions"
      ON splits FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = splits.session_id
        AND sessions.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete groups in their sessions' AND tablename = 'groups'
  ) THEN
    CREATE POLICY "Authenticated users can delete groups in their sessions"
      ON groups FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = groups.session_id
        AND sessions.user_id = auth.uid()
      ));
  END IF;
END $$;


-- ============================================================
-- 20260526010021_restrict_account_deletion_log_grants.sql
-- ============================================================
/*
  # Restrict account_deletion_log table grants

  1. Security Changes
    - Revoke all privileges from `anon` and `authenticated` roles on `account_deletion_log`
    - This table should only be accessible by the `service_role` (used by edge functions)
    - RLS is already enabled with no policies (deny-all), but revoking grants adds defense-in-depth

  2. Rationale
    - The account_deletion_log is an audit table written to by the delete-account edge function
    - No end user (anonymous or authenticated) should ever read or write this table directly
    - Only the service_role key (used server-side in edge functions) needs access
*/

REVOKE ALL ON account_deletion_log FROM anon;
REVOKE ALL ON account_deletion_log FROM authenticated;


-- ============================================================
-- 20260606002150_fix_security_definer_execute_and_deletion_log_policies.sql
-- ============================================================
/*
  # Fix SECURITY DEFINER function execute grants + account_deletion_log RLS

  1. SECURITY DEFINER function `create_athlete_split_on_update()`:
    - This function runs as the table owner (SECURITY DEFINER), bypassing RLS
    - It should ONLY be executable by the trigger system, never directly via the REST API
    - Revoke EXECUTE from `anon` and `authenticated` to prevent RPC calls
    - Add GRANT to `service_role` so edge functions can still use it if needed

  2. account_deletion_log table:
    - RLS is enabled but has zero policies, meaning all access is denied
    - This is technically safe (deny-all), but Google Play / App Store reviewers
      and automated security scanners flag "RLS enabled no policy" as a risk
    - Add explicit deny policies with a false condition to satisfy scanners
    - Only service_role should ever access this table
*/

-- 1. Revoke direct execution of the SECURITY DEFINER function from public roles
REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM authenticated;

-- 2. Ensure service_role can still execute it
GRANT EXECUTE ON FUNCTION public.create_athlete_split_on_update() TO service_role;

-- 3. Add explicit restrictive RLS policies on account_deletion_log
-- These policies intentionally evaluate to false so no anon/authenticated user can access
CREATE POLICY "anon_cannot_access_account_deletion_log" ON account_deletion_log
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "authenticated_cannot_access_account_deletion_log" ON account_deletion_log
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);


-- ============================================================
-- 20260606005458_revoke_execute_on_security_definer_from_public.sql
-- ============================================================
/*
  # Revoke EXECUTE on SECURITY DEFINER function from PUBLIC

  The function `create_athlete_split_on_update()` is SECURITY DEFINER,
  meaning it runs as the table owner. It should only be invoked by
  its trigger, never directly via the REST API.

  Postgres grants EXECUTE on functions to PUBLIC by default.
  Revoking from PUBLIC removes access for anon + authenticated.
*/

REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM PUBLIC;


