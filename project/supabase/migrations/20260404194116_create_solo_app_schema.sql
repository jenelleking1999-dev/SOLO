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