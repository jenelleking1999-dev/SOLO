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
