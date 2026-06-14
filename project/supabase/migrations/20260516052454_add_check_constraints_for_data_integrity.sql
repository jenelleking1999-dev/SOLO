/*
  # Add CHECK constraints for data integrity

  1. Changes
    - Add CHECK constraint on `splits.time_ms` to ensure positive values
    - Add CHECK constraint on `workouts.reps` to ensure positive values
    - Add CHECK constraint on `workouts.target_time` to ensure non-negative values
    - Add CHECK constraint on `workouts.rest_time` to ensure non-negative values
    - Add CHECK constraint on `athlete_splits.time_ms` to ensure positive values
    - Add CHECK constraint on `athlete_splits.rep_number` to ensure positive values
    - Add CHECK constraint on `splits.rep_number` to ensure positive values

  2. Security
    - Prevents invalid data from being inserted at the database level
    - Blocks negative times, zero reps, and other nonsensical values
    - Acts as server-side validation layer regardless of client behavior

  3. Important Notes
    - Uses DO blocks to safely add constraints only if they don't exist
    - Will not affect existing valid data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'splits_time_ms_positive'
  ) THEN
    ALTER TABLE splits ADD CONSTRAINT splits_time_ms_positive CHECK (time_ms > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'splits_rep_number_positive'
  ) THEN
    ALTER TABLE splits ADD CONSTRAINT splits_rep_number_positive CHECK (rep_number > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workouts_reps_positive'
  ) THEN
    ALTER TABLE workouts ADD CONSTRAINT workouts_reps_positive CHECK (reps > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workouts_target_time_non_negative'
  ) THEN
    ALTER TABLE workouts ADD CONSTRAINT workouts_target_time_non_negative CHECK (target_time >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workouts_rest_time_non_negative'
  ) THEN
    ALTER TABLE workouts ADD CONSTRAINT workouts_rest_time_non_negative CHECK (rest_time >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athlete_splits_time_ms_positive'
  ) THEN
    ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_time_ms_positive CHECK (time_ms > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athlete_splits_rep_number_positive'
  ) THEN
    ALTER TABLE athlete_splits ADD CONSTRAINT athlete_splits_rep_number_positive CHECK (rep_number > 0);
  END IF;
END $$;
