/*
  # Fix stale athlete_splits rows when a split's athlete is renamed

  ## Problem
  `athlete_splits` has a UNIQUE (split_id, athlete_name) key and the trigger
  upserts on it. When a split's athlete is renamed (e.g. voice recorded "Sean"
  but the coach corrects it to "John"), the trigger inserts a NEW row for
  (split, "John") and leaves the old (split, "Sean") row behind. Results /
  athlete history then still show the old athlete.

  ## Fix
  1. Trigger: on an UPDATE that changes athlete_name, delete the athlete_splits
     row for the previous name before inserting the new one. Runs as
     SECURITY DEFINER so it bypasses RLS.
  2. One-time cleanup: remove any athlete_splits rows whose name no longer
     matches the split's current athlete_name (clears rows left by past renames).
*/

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
  -- On a rename (or clearing) of the primary athlete, drop the stale row that
  -- was recorded for the previous name so it no longer appears in results.
  IF TG_OP = 'UPDATE'
     AND OLD.athlete_name IS NOT NULL
     AND OLD.athlete_name IS DISTINCT FROM NEW.athlete_name THEN
    DELETE FROM athlete_splits
    WHERE split_id = NEW.id
      AND athlete_name = OLD.athlete_name;
  END IF;

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

-- One-time cleanup of rows left behind by past renames.
DELETE FROM athlete_splits a
USING splits s
WHERE a.split_id = s.id
  AND a.athlete_name IS DISTINCT FROM s.athlete_name;
