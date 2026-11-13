/*
  # Coach notes about athletes

  ## Why
  On the Home screen a coach can say or type a note about an athlete, e.g.
  "Alex is performing very well today". The note is saved against that
  athlete, dated, and shown to the coach, to the athlete, and to the athlete's
  parent(s).

  ## Change
  - New table `athlete_notes`: one row per athlete per note. Like recorded
    marks, athletes are identified by coach account + athlete name (matched
    case-insensitively), so notes line up with the same invite links
    (athlete_links) that already give athletes/parents access to marks.
  - Coaches can create, see and delete their own notes (owner-only RLS).
  - Athletes/parents read notes only through get_linked_athlete_notes(), which
    checks the caller's own athlete_links row — the same pattern as
    get_linked_athlete_history(). Notes written before the link existed are
    included.

  ## Safe for older app versions
  Additive only.
*/

CREATE TABLE IF NOT EXISTS athlete_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_name text NOT NULL CHECK (char_length(athlete_name) BETWEEN 1 AND 100),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS athlete_notes_coach_athlete_idx
  ON athlete_notes(coach_id, lower(athlete_name), created_at DESC);

ALTER TABLE athlete_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches can view their notes" ON athlete_notes;
CREATE POLICY "Coaches can view their notes"
  ON athlete_notes FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = coach_id);

DROP POLICY IF EXISTS "Coaches can add notes" ON athlete_notes;
CREATE POLICY "Coaches can add notes"
  ON athlete_notes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = coach_id AND public.current_account_role() = 'coach');

DROP POLICY IF EXISTS "Coaches can delete their notes" ON athlete_notes;
CREATE POLICY "Coaches can delete their notes"
  ON athlete_notes FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = coach_id);

-- Athlete/parent: the coach's notes about one linked athlete, newest first.
-- Returns nothing unless the link is the caller's own.
CREATE OR REPLACE FUNCTION public.get_linked_athlete_notes(p_link_id uuid)
RETURNS TABLE (id uuid, note text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT n.id, n.note, n.created_at
  FROM public.athlete_links al
  JOIN public.athlete_notes n
    ON n.coach_id = al.coach_id
   AND lower(n.athlete_name) = lower(al.athlete_name)
  WHERE al.id = p_link_id
    AND al.user_id = auth.uid()
  ORDER BY n.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_linked_athlete_notes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_linked_athlete_notes(uuid) TO authenticated;
