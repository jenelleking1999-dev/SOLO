/*
  # Add split_order to groups table

  ## Overview
  Persists the split-to-athlete mapping for each group so that subsequent reps
  automatically reuse the same athlete assignment order established during the first rep.

  ## Changes to `groups`
  - `split_order` (text[], nullable) — ordered list of athlete names matching the split
    positions recorded in the first rep. Index 0 = split #1, index 1 = split #2, etc.
    This is identical to `athlete_names` by default but stored separately to allow
    future flexibility (e.g. athletes per group > split count).

  ## How it works
  - On first rep completion the coach assigns athletes to splits.
  - The ordered athlete name array is saved into `split_order`.
  - For all subsequent reps, `split_order` is used to auto-fill athlete_name on each
    new split without requiring coach input, and the group advances automatically.

  ## Notes
  - Nullable so existing groups without this data remain valid.
  - No data loss — purely additive column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'split_order'
  ) THEN
    ALTER TABLE groups ADD COLUMN split_order text[] DEFAULT '{}';
  END IF;
END $$;
