/*
  # Fix athlete_splits completeness for segmented workouts

  1. Schema Changes
    - `athlete_splits`: Add `segment_index` (integer, default 0) to track which workout
      segment a result belongs to

  2. Trigger Function Rebuild
    - Rebuild `create_athlete_split_on_update` to include ALL metadata columns:
      group_id, group_label, workout_name, and segment_index
    - The previous security-fix migration accidentally dropped group_id, group_label,
      and workout_name from the trigger's INSERT list
    - Uses segment-specific distance from the workout's segments JSON when available,
      falling back to the workout-level distance for non-segmented workouts
    - Maintains SECURITY DEFINER and search_path = public

  3. Data Integrity
    - Backfills segment_index = 0 on all existing athlete_splits rows (default)
    - Backfills missing group_label and workout_name on existing rows
    - No destructive operations; all changes are additive

  4. Important Notes
    - The composite unique constraint (split_id, athlete_name) is preserved
    - Both INSERT and UPDATE triggers are recreated
*/

-- 1. Add segment_index column to athlete_splits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athlete_splits' AND column_name = 'segment_index'
  ) THEN
    ALTER TABLE athlete_splits ADD COLUMN segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 2. Rebuild trigger function with ALL columns, including segment_index
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
      time_ms      = EXCLUDED.time_ms,
      group_number = EXCLUDED.group_number,
      group_id     = EXCLUDED.group_id,
      group_label  = EXCLUDED.group_label,
      workout_name = EXCLUDED.workout_name,
      segment_index = EXCLUDED.segment_index,
      distance     = EXCLUDED.distance;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Recreate triggers
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

-- 4. Backfill missing group_label, workout_name, segment_index on existing records
UPDATE athlete_splits ath
SET
  group_label   = COALESCE(ath.group_label, g.label),
  workout_name  = COALESCE(ath.workout_name, w.name),
  segment_index = COALESCE(sp.segment_index, 0)
FROM splits sp
JOIN sessions s  ON s.id  = sp.session_id
JOIN workouts w  ON w.id  = s.workout_id
LEFT JOIN groups g ON g.id = sp.group_id
WHERE ath.split_id = sp.id
  AND (ath.group_label IS NULL OR ath.workout_name IS NULL);
