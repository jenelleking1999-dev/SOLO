/*
  # Allow anonymous (guest) users to delete splits in their own sessions

  ## Why
  The post-rep athlete assignment screen lets a coach delete a mistaken split
  time. Guest (anonymous) sessions had no DELETE policy on `splits`, so RLS
  silently blocked the delete (0 rows affected) and the split reappeared.

  ## Change
  - Add a DELETE policy for the `anon` role scoped to splits whose session is a
    guest session (user_id IS NULL), mirroring the existing anon insert/update
    policies.

  ## Notes
  - Deleting a split cascades to `athlete_splits` via the existing
    ON DELETE CASCADE foreign key, so no separate athlete_splits policy is needed.
  - Authenticated users already have a DELETE policy from a prior migration.
*/

DROP POLICY IF EXISTS "Anon users can delete splits in guest sessions" ON splits;
CREATE POLICY "Anon users can delete splits in guest sessions"
  ON splits FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = splits.session_id
      AND sessions.user_id IS NULL
    )
  );
