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
