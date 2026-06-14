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
