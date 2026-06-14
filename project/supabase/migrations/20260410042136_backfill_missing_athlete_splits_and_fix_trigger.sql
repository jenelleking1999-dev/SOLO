/*
  # Backfill Missing Athlete Splits and Fix Trigger

  ## Problem
  1. Splits that were assigned athlete names before the trigger was created have no
     corresponding athlete_splits records. These need to be backfilled.
  2. The trigger only fires on UPDATE OF athlete_name, but not on INSERT when an
     athlete_name is already provided. This edge case should also be handled.

  ## Changes
  1. Backfill athlete_splits for all splits that have an athlete_name but no
     corresponding record in athlete_splits.
  2. Update the trigger function and add an INSERT trigger to cover the INSERT case.
*/

-- Backfill missing athlete_splits records for splits that already have athlete names
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
  sp.athlete_name,
  sp.id,
  sp.session_id,
  s.workout_id,
  s.user_id,
  sp.rep_number,
  sp.time_ms,
  w.distance,
  sp.group_number,
  COALESCE(sp.timestamp, sp.created_at, now())
FROM splits sp
JOIN sessions s ON s.id = sp.session_id
JOIN workouts w ON w.id = s.workout_id
LEFT JOIN athlete_splits ath ON ath.split_id = sp.id
WHERE sp.athlete_name IS NOT NULL
AND ath.id IS NULL
ON CONFLICT (split_id) DO NOTHING;

-- Update trigger function to handle both INSERT and UPDATE cases
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
    ON CONFLICT (split_id)
    DO UPDATE SET
      athlete_name = EXCLUDED.athlete_name,
      group_number = EXCLUDED.group_number,
      time_ms = EXCLUDED.time_ms;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add INSERT trigger so splits inserted with an athlete_name are also tracked
DROP TRIGGER IF EXISTS splits_athlete_insert_trigger ON splits;
CREATE TRIGGER splits_athlete_insert_trigger
  AFTER INSERT ON splits
  FOR EACH ROW
  WHEN (NEW.athlete_name IS NOT NULL)
  EXECUTE FUNCTION create_athlete_split_on_update();
