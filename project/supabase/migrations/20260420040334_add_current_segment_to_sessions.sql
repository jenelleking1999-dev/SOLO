/*
  # Add current_segment_index to sessions table

  ## Summary
  Adds a `current_segment_index` column to the `sessions` table to track
  which segment of a multi-segment workout is currently being executed.

  ## Changes
  - `sessions` table: new `current_segment_index` integer column (default 0)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'current_segment_index'
  ) THEN
    ALTER TABLE sessions ADD COLUMN current_segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;
