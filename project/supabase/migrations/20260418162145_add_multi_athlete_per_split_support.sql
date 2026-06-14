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
