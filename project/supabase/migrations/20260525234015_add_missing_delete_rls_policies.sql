/*
  # Add Missing DELETE RLS Policies

  1. Security Changes
    - Add DELETE policy for `athlete_splits` so authenticated users can remove their own records
    - Add DELETE policy for `splits` so authenticated users can remove splits in their sessions
    - Add DELETE policy for `groups` so authenticated users can remove groups in their sessions

  2. Notes
    - These tables previously had no DELETE policies, meaning authenticated users
      could not explicitly delete records even though CASCADE handles parent deletions
    - Without explicit DELETE policies, RLS blocks all direct DELETE operations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete their athlete_splits' AND tablename = 'athlete_splits'
  ) THEN
    CREATE POLICY "Authenticated users can delete their athlete_splits"
      ON athlete_splits FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete splits in their sessions' AND tablename = 'splits'
  ) THEN
    CREATE POLICY "Authenticated users can delete splits in their sessions"
      ON splits FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = splits.session_id
        AND sessions.user_id = auth.uid()
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete groups in their sessions' AND tablename = 'groups'
  ) THEN
    CREATE POLICY "Authenticated users can delete groups in their sessions"
      ON groups FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM sessions
        WHERE sessions.id = groups.session_id
        AND sessions.user_id = auth.uid()
      ));
  END IF;
END $$;
