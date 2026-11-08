/*
  # Scheduled workouts (Home screen calendar)

  ## Why
  Coaches can plan workouts in advance on the Home screen calendar. On the day,
  tapping a scheduled workout loads it into the workout builder, ready to Start.

  ## Change
  - New table `scheduled_workouts`: one row per planned workout per date.
    `workout` holds the generated workout (same shape the app builds from
    `parseWorkoutText`), `workout_text` the coach's original description.
  - Signed-in coaches only: each coach can see and change only their own rows.
    There are no anon policies, so guests cannot read or write this table.
  - Rows are removed automatically when the coach's account is deleted
    (ON DELETE CASCADE from auth.users).

  ## Safe for older app versions
  Additive only: no existing table or column changes.
*/

CREATE TABLE IF NOT EXISTS scheduled_workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  workout_text text CHECK (workout_text IS NULL OR char_length(workout_text) <= 2000),
  workout jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_workouts_user_date_idx
  ON scheduled_workouts(user_id, scheduled_date);

ALTER TABLE scheduled_workouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their scheduled workouts" ON scheduled_workouts;
CREATE POLICY "Users can view their scheduled workouts"
  ON scheduled_workouts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can schedule their own workouts" ON scheduled_workouts;
CREATE POLICY "Users can schedule their own workouts"
  ON scheduled_workouts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their scheduled workouts" ON scheduled_workouts;
CREATE POLICY "Users can update their scheduled workouts"
  ON scheduled_workouts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their scheduled workouts" ON scheduled_workouts;
CREATE POLICY "Users can delete their scheduled workouts"
  ON scheduled_workouts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
