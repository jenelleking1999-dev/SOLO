/*
  # Allow deleting an in-progress session (and its results via cascade)

  ## Why
  When a coach starts a new workout while an unfinished one is still in progress,
  the app deletes the old, incomplete session. Deleting the session cascades to
  its splits, groups, and athlete_splits (ON DELETE CASCADE). But there was no
  DELETE policy on `sessions` for either role, so RLS blocked the delete.

  ## Change
  - Authenticated users: delete sessions they own.
  - Anonymous users: delete their guest sessions (user_id IS NULL).
*/

DROP POLICY IF EXISTS "Authenticated users can delete their sessions" ON sessions;
CREATE POLICY "Authenticated users can delete their sessions"
  ON sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anon users can delete guest sessions" ON sessions;
CREATE POLICY "Anon users can delete guest sessions"
  ON sessions FOR DELETE
  TO anon
  USING (user_id IS NULL);
