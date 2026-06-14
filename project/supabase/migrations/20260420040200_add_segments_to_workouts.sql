/*
  # Add segments column to workouts table

  ## Summary
  Adds a `segments` JSONB column to the `workouts` table to support multi-segment
  workout definitions. Each segment stores its own reps, distance, target time, and rest.

  ## Changes
  - `workouts` table: new `segments` JSONB column (nullable, defaults to empty array)

  ## Notes
  - Existing workouts will have segments = '[]' and continue to use the flat columns
  - New multi-segment workouts populate this array
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'segments'
  ) THEN
    ALTER TABLE workouts ADD COLUMN segments jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;
