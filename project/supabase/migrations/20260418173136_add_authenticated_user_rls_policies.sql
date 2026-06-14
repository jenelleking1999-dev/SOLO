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
