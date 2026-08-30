-- =============================================================
-- COACHINGSOLO PRODUCTION DATABASE SETUP
-- Run this entire file once in the Supabase SQL Editor
-- on your production Supabase project.
-- =============================================================


-- -------------------------------------------------------------
-- MIGRATION 1: Create core schema
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workouts_user_id_idx ON workouts(user_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_workout_id_idx ON sessions(workout_id);
CREATE INDEX IF NOT EXISTS splits_session_id_idx ON splits(session_id);
CREATE INDEX IF NOT EXISTS athletes_user_id_idx ON athletes(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes ENABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------------
-- MIGRATION 2: Add athlete split history table
-- -------------------------------------------------------------

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

CREATE INDEX IF NOT EXISTS athlete_splits_athlete_name_idx ON athlete_splits(athlete_name);
CREATE INDEX IF NOT EXISTS athlete_splits_user_id_idx ON athlete_splits(user_id);
CREATE INDEX IF NOT EXISTS athlete_splits_session_id_idx ON athlete_splits(session_id);
CREATE INDEX IF NOT EXISTS athlete_splits_workout_id_idx ON athlete_splits(workout_id);
CREATE INDEX IF NOT EXISTS athlete_splits_history_idx ON athlete_splits(athlete_name, user_id, recorded_at DESC);

ALTER TABLE athlete_splits ENABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------------
-- MIGRATION 3: Add groups table and group_id to splits
-- -------------------------------------------------------------

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


-- -------------------------------------------------------------
-- MIGRATION 4: Add extra columns to athlete_splits
-- -------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athlete_splits' AND column_name = 'group_id') THEN
    ALTER TABLE athlete_splits ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athlete_splits' AND column_name = 'group_label') THEN
    ALTER TABLE athlete_splits ADD COLUMN group_label text;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athlete_splits' AND column_name = 'workout_name') THEN
    ALTER TABLE athlete_splits ADD COLUMN workout_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS athlete_splits_group_id_idx ON athlete_splits(group_id);


-- -------------------------------------------------------------
-- MIGRATION 5: Add split_order to groups
-- -------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'split_order') THEN
    ALTER TABLE groups ADD COLUMN split_order text[] DEFAULT '{}';
  END IF;
END $$;


-- -------------------------------------------------------------
-- MIGRATION 6: Multi-athlete per split — drop old unique, add composite
-- -------------------------------------------------------------

DROP INDEX IF EXISTS athlete_splits_split_id_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'athlete_splits' AND constraint_name = 'athlete_splits_split_id_key' AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE athlete_splits DROP CONSTRAINT athlete_splits_split_id_key;
  END IF;
END $$;

-- Also drop the old single-column unique constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'athlete_splits' AND constraint_name = 'athlete_splits_split_id_unique' AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE athlete_splits DROP CONSTRAINT athlete_splits_split_id_unique;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'athlete_splits' AND constraint_name = 'athlete_splits_split_athlete_unique' AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_split_athlete_unique UNIQUE (split_id, athlete_name);
  END IF;
END $$;


-- -------------------------------------------------------------
-- MIGRATION 7: Add segments to workouts
-- -------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workouts' AND column_name = 'segments') THEN
    ALTER TABLE workouts ADD COLUMN segments jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;


-- -------------------------------------------------------------
-- MIGRATION 8: Add current_segment_index to sessions
-- -------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'current_segment_index') THEN
    ALTER TABLE sessions ADD COLUMN current_segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;


-- -------------------------------------------------------------
-- MIGRATION 9: Add segment_index to splits
-- -------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'splits' AND column_name = 'segment_index') THEN
    ALTER TABLE splits ADD COLUMN segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;


-- -------------------------------------------------------------
-- MIGRATION 10: Add segment_index to athlete_splits
-- -------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'athlete_splits' AND column_name = 'segment_index') THEN
    ALTER TABLE athlete_splits ADD COLUMN segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;


-- -------------------------------------------------------------
-- MIGRATION 11: Add CHECK constraints for data integrity
-- -------------------------------------------------------------

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'splits_time_ms_positive') THEN ALTER TABLE splits ADD CONSTRAINT splits_time_ms_positive CHECK (time_ms > 0); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'splits_rep_number_positive') THEN ALTER TABLE splits ADD CONSTRAINT splits_rep_number_positive CHECK (rep_number > 0); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workouts_reps_positive') THEN ALTER TABLE workouts ADD CONSTRAINT workouts_reps_positive CHECK (reps > 0); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workouts_target_time_non_negative') THEN ALTER TABLE workouts ADD CONSTRAINT workouts_target_time_non_negative CHECK (target_time >= 0); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workouts_rest_time_non_negative') THEN ALTER TABLE workouts ADD CONSTRAINT workouts_rest_time_non_negative CHECK (rest_time >= 0); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athlete_splits_time_ms_positive') THEN ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_time_ms_positive CHECK (time_ms > 0); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'athlete_splits_rep_number_positive') THEN ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_rep_number_positive CHECK (rep_number > 0); END IF; END $$;


-- -------------------------------------------------------------
-- MIGRATION 12: account_deletion_log table (used by delete-account edge function)
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS account_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  deleted_at timestamptz DEFAULT now()
);

ALTER TABLE account_deletion_log ENABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------------
-- MIGRATION 13: All RLS policies (clean combined set)
-- Drop first so re-running never errors
-- -------------------------------------------------------------

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- workouts
DROP POLICY IF EXISTS "Anon users can insert guest workouts" ON workouts;
DROP POLICY IF EXISTS "Anon users can update guest workouts" ON workouts;
DROP POLICY IF EXISTS "Anonymous users can view temporary workouts" ON workouts;
DROP POLICY IF EXISTS "Authenticated users can insert their workouts" ON workouts;
DROP POLICY IF EXISTS "Authenticated users can view their workouts" ON workouts;
DROP POLICY IF EXISTS "Authenticated users can update their workouts" ON workouts;
DROP POLICY IF EXISTS "Users can delete own workouts" ON workouts;
CREATE POLICY "Anon users can insert guest workouts" ON workouts FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Anon users can update guest workouts" ON workouts FOR UPDATE TO anon USING (user_id IS NULL) WITH CHECK (user_id IS NULL);
CREATE POLICY "Anonymous users can view temporary workouts" ON workouts FOR SELECT TO anon USING (user_id IS NULL);
CREATE POLICY "Authenticated users can insert their workouts" ON workouts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can view their workouts" ON workouts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update their workouts" ON workouts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own workouts" ON workouts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- sessions
DROP POLICY IF EXISTS "Anon users can insert guest sessions" ON sessions;
DROP POLICY IF EXISTS "Anon users can update guest sessions" ON sessions;
DROP POLICY IF EXISTS "Anonymous users can view temporary sessions" ON sessions;
DROP POLICY IF EXISTS "Authenticated users can insert their sessions" ON sessions;
DROP POLICY IF EXISTS "Authenticated users can view their sessions" ON sessions;
DROP POLICY IF EXISTS "Authenticated users can update their sessions" ON sessions;
CREATE POLICY "Anon users can insert guest sessions" ON sessions FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "Anon users can update guest sessions" ON sessions FOR UPDATE TO anon USING (user_id IS NULL) WITH CHECK (user_id IS NULL);
CREATE POLICY "Anonymous users can view temporary sessions" ON sessions FOR SELECT TO anon USING (user_id IS NULL);
CREATE POLICY "Authenticated users can insert their sessions" ON sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can view their sessions" ON sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update their sessions" ON sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- splits
DROP POLICY IF EXISTS "Anon users can insert splits in guest sessions" ON splits;
DROP POLICY IF EXISTS "Anon users can update splits in guest sessions" ON splits;
DROP POLICY IF EXISTS "Anonymous users can view splits in temporary sessions" ON splits;
DROP POLICY IF EXISTS "Authenticated users can insert splits in their sessions" ON splits;
DROP POLICY IF EXISTS "Authenticated users can view splits in their sessions" ON splits;
DROP POLICY IF EXISTS "Authenticated users can update splits in their sessions" ON splits;
DROP POLICY IF EXISTS "Authenticated users can delete splits in their sessions" ON splits;
CREATE POLICY "Anon users can insert splits in guest sessions" ON splits FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Anon users can update splits in guest sessions" ON splits FOR UPDATE TO anon USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id IS NULL)) WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Anonymous users can view splits in temporary sessions" ON splits FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Authenticated users can insert splits in their sessions" ON splits FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id = auth.uid()));
CREATE POLICY "Authenticated users can view splits in their sessions" ON splits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id = auth.uid()));
CREATE POLICY "Authenticated users can update splits in their sessions" ON splits FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id = auth.uid()));
CREATE POLICY "Authenticated users can delete splits in their sessions" ON splits FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = splits.session_id AND sessions.user_id = auth.uid()));

-- groups
DROP POLICY IF EXISTS "Anon users can view groups in anon sessions" ON groups;
DROP POLICY IF EXISTS "Anon users can create groups in anon sessions" ON groups;
DROP POLICY IF EXISTS "Anon users can update groups in anon sessions" ON groups;
DROP POLICY IF EXISTS "Authenticated users can insert groups in their sessions" ON groups;
DROP POLICY IF EXISTS "Authenticated users can view groups in their sessions" ON groups;
DROP POLICY IF EXISTS "Authenticated users can update groups in their sessions" ON groups;
DROP POLICY IF EXISTS "Authenticated users can delete groups in their sessions" ON groups;
CREATE POLICY "Anon users can view groups in anon sessions" ON groups FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Anon users can create groups in anon sessions" ON groups FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Anon users can update groups in anon sessions" ON groups FOR UPDATE TO anon USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id IS NULL)) WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Authenticated users can insert groups in their sessions" ON groups FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id = auth.uid()));
CREATE POLICY "Authenticated users can view groups in their sessions" ON groups FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id = auth.uid()));
CREATE POLICY "Authenticated users can update groups in their sessions" ON groups FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id = auth.uid()));
CREATE POLICY "Authenticated users can delete groups in their sessions" ON groups FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = groups.session_id AND sessions.user_id = auth.uid()));

-- athletes
DROP POLICY IF EXISTS "Authenticated users can insert their athletes" ON athletes;
DROP POLICY IF EXISTS "Authenticated users can view their athletes" ON athletes;
DROP POLICY IF EXISTS "Authenticated users can update their athletes" ON athletes;
DROP POLICY IF EXISTS "Authenticated users can delete their athletes" ON athletes;
CREATE POLICY "Authenticated users can insert their athletes" ON athletes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can view their athletes" ON athletes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update their athletes" ON athletes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete their athletes" ON athletes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- athlete_splits
DROP POLICY IF EXISTS "Anonymous users can view athlete splits from their sessions" ON athlete_splits;
DROP POLICY IF EXISTS "Anonymous users can create athlete splits" ON athlete_splits;
DROP POLICY IF EXISTS "Anonymous users can update athlete splits" ON athlete_splits;
DROP POLICY IF EXISTS "Authenticated users can insert their athlete_splits" ON athlete_splits;
DROP POLICY IF EXISTS "Authenticated users can view their athlete_splits" ON athlete_splits;
DROP POLICY IF EXISTS "Authenticated users can update their athlete_splits" ON athlete_splits;
DROP POLICY IF EXISTS "Authenticated users can delete their athlete_splits" ON athlete_splits;
CREATE POLICY "Anonymous users can view athlete splits from their sessions" ON athlete_splits FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = athlete_splits.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Anonymous users can create athlete splits" ON athlete_splits FOR INSERT TO anon WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = athlete_splits.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Anonymous users can update athlete splits" ON athlete_splits FOR UPDATE TO anon USING (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = athlete_splits.session_id AND sessions.user_id IS NULL)) WITH CHECK (EXISTS (SELECT 1 FROM sessions WHERE sessions.id = athlete_splits.session_id AND sessions.user_id IS NULL));
CREATE POLICY "Authenticated users can insert their athlete_splits" ON athlete_splits FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can view their athlete_splits" ON athlete_splits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can update their athlete_splits" ON athlete_splits FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authenticated users can delete their athlete_splits" ON athlete_splits FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- account_deletion_log
DROP POLICY IF EXISTS "anon_cannot_access_account_deletion_log" ON account_deletion_log;
DROP POLICY IF EXISTS "authenticated_cannot_access_account_deletion_log" ON account_deletion_log;
CREATE POLICY "anon_cannot_access_account_deletion_log" ON account_deletion_log FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "authenticated_cannot_access_account_deletion_log" ON account_deletion_log FOR ALL TO authenticated USING (false) WITH CHECK (false);


-- -------------------------------------------------------------
-- MIGRATION 14: Create the trigger function (SECURITY DEFINER)
-- -------------------------------------------------------------

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
      time_ms       = EXCLUDED.time_ms,
      group_number  = EXCLUDED.group_number,
      group_id      = EXCLUDED.group_id,
      group_label   = EXCLUDED.group_label,
      workout_name  = EXCLUDED.workout_name,
      segment_index = EXCLUDED.segment_index,
      distance      = EXCLUDED.distance;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach triggers
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


-- -------------------------------------------------------------
-- MIGRATION 15: Lock down SECURITY DEFINER function permissions
-- -------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_athlete_split_on_update() TO service_role;

REVOKE ALL ON account_deletion_log FROM anon;
REVOKE ALL ON account_deletion_log FROM authenticated;

-- =============================================================
-- DONE. Your production database is ready.
-- =============================================================
