/*
  # Add segment_index to splits table

  1. Modified Tables
    - `splits`
      - Added `segment_index` (integer, default 0) to track which workout segment a split belongs to
  2. Important Notes
    - Existing splits are assigned segment_index = 0 by default (backward compatible)
    - This enables proper isolation of split data between workout segments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'splits' AND column_name = 'segment_index'
  ) THEN
    ALTER TABLE splits ADD COLUMN segment_index integer NOT NULL DEFAULT 0;
  END IF;
END $$;
