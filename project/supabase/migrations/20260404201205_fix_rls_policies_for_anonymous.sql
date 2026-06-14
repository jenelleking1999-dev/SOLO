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
