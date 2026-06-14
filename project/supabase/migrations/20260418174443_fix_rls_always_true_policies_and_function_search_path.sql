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
