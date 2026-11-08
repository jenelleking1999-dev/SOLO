/*
  # Athlete and parent accounts

  ## Why
  Besides coaches, athletes and parents can now create accounts. They can only
  VIEW the marks a coach recorded: an athlete sees their own, a parent sees
  their child(ren)'s. Historical marks are included.

  ## How an athlete/parent is connected to a coach
  Recorded marks (athlete_splits) are stored per coach account + athlete name,
  so there is nothing an athlete or parent could safely match on by themselves
  (names repeat; coaches don't have athletes' emails). Instead the COACH
  creates a one-time invite code for a specific athlete name, choosing whether
  it is for the athlete or for a parent, and hands it over. Redeeming the code
  creates an `athlete_links` row: (coach, athlete name, viewer account).
  - Codes: 8 characters, single use, expire after 14 days.
  - A parent can redeem several codes (several children); an athlete can
    redeem codes from several coaches.
  - The coach can see who is connected and remove access; the viewer can
    disconnect themselves.

  ## Security model
  - Existing tables keep their owner-only RLS; no new policies are added on
    athlete_splits, sessions or workouts.
  - Athletes/parents read marks only through SECURITY DEFINER functions that
    check the caller's own athlete_links row and return completed-session
    marks for that one coach + athlete name.

  ## Roles
  - profiles.role: 'coach' | 'athlete' | 'parent'. Every existing account is a
    coach (default).
  - A profile row is now created automatically on sign-up (trigger on
    auth.users) from the sign-up metadata. Previously the app inserted it
    client-side, which fails while the account awaits email confirmation.

  ## Safe for older app versions
  Additive only. Old app versions keep signing users up as coaches.
*/

-- ============================================================
-- 1. Roles + automatic profile creation
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'coach'
  CHECK (role IN ('coach', 'athlete', 'parent'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' IN ('athlete', 'parent')
        THEN NEW.raw_user_meta_data->>'role'
      ELSE 'coach'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- The caller's role. Accounts without a profile row are treated as coaches,
-- which is what every account was before roles existed.
CREATE OR REPLACE FUNCTION public.current_account_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'coach');
$$;

-- ============================================================
-- 2. Invites and links
-- ============================================================
CREATE TABLE IF NOT EXISTS athlete_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_name text NOT NULL CHECK (char_length(athlete_name) BETWEEN 1 AND 100),
  relationship text NOT NULL CHECK (relationship IN ('athlete', 'parent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  redeemed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_at timestamptz
);

CREATE INDEX IF NOT EXISTS athlete_invites_coach_idx ON athlete_invites(coach_id);

CREATE TABLE IF NOT EXISTS athlete_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_name text NOT NULL CHECK (char_length(athlete_name) BETWEEN 1 AND 100),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relationship text NOT NULL CHECK (relationship IN ('athlete', 'parent')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS athlete_links_unique_idx
  ON athlete_links(coach_id, lower(athlete_name), user_id);
CREATE INDEX IF NOT EXISTS athlete_links_user_idx ON athlete_links(user_id);

ALTER TABLE athlete_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_links ENABLE ROW LEVEL SECURITY;

-- Invites: created/redeemed only through the functions below. Coaches can see
-- and cancel their own.
DROP POLICY IF EXISTS "Coaches can view their invites" ON athlete_invites;
CREATE POLICY "Coaches can view their invites"
  ON athlete_invites FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = coach_id);

DROP POLICY IF EXISTS "Coaches can cancel their invites" ON athlete_invites;
CREATE POLICY "Coaches can cancel their invites"
  ON athlete_invites FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = coach_id);

-- Links: created only by redeem_athlete_invite. Both sides can see and remove.
DROP POLICY IF EXISTS "Coach and viewer can view links" ON athlete_links;
CREATE POLICY "Coach and viewer can view links"
  ON athlete_links FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = coach_id OR (select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Coach and viewer can remove links" ON athlete_links;
CREATE POLICY "Coach and viewer can remove links"
  ON athlete_links FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = coach_id OR (select auth.uid()) = user_id);

-- ============================================================
-- 3. Functions
-- ============================================================

-- Coach: create a one-time code for one athlete, for the athlete or a parent.
CREATE OR REPLACE FUNCTION public.create_athlete_invite(p_athlete_name text, p_relationship text)
RETURNS TABLE (code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(p_athlete_name);
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- no 0/O, 1/I/L
  v_code text;
  v_bytes bytea;
  i int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to invite athletes or parents.';
  END IF;
  IF public.current_account_role() <> 'coach' THEN
    RAISE EXCEPTION 'Only coach accounts can create invite codes.';
  END IF;
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid athlete name.';
  END IF;
  IF p_relationship NOT IN ('athlete', 'parent') THEN
    RAISE EXCEPTION 'Invalid invite type.';
  END IF;

  LOOP
    -- gen_random_uuid() uses a cryptographically secure random source.
    v_bytes := uuid_send(gen_random_uuid());
    v_code := '';
    FOR i IN 0..7 LOOP
      v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) % length(v_alphabet)), 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.athlete_invites ai WHERE ai.code = v_code);
  END LOOP;

  RETURN QUERY
  INSERT INTO public.athlete_invites (code, coach_id, athlete_name, relationship)
  VALUES (v_code, v_uid, v_name, p_relationship)
  RETURNING athlete_invites.code, athlete_invites.expires_at;
END;
$$;

-- Athlete/parent: redeem a code, creating the link to that coach's athlete.
CREATE OR REPLACE FUNCTION public.redeem_athlete_invite(p_code text)
RETURNS TABLE (link_id uuid, athlete_name text, coach_name text, relationship text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_role text := public.current_account_role();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_invite public.athlete_invites%ROWTYPE;
  v_link_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to enter a code.';
  END IF;
  IF v_role NOT IN ('athlete', 'parent') THEN
    RAISE EXCEPTION 'Invite codes are for athlete and parent accounts.';
  END IF;

  SELECT * INTO v_invite FROM public.athlete_invites ai WHERE ai.code = v_code FOR UPDATE;

  IF NOT FOUND OR v_invite.redeemed_at IS NOT NULL OR v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'This code is invalid, expired or already used. Ask your coach for a new one.';
  END IF;
  IF v_invite.relationship <> v_role THEN
    RAISE EXCEPTION 'This code is for a % account. Ask your coach for a % code.',
      v_invite.relationship, v_role;
  END IF;
  IF v_invite.coach_id = v_uid THEN
    RAISE EXCEPTION 'You cannot redeem your own invite code.';
  END IF;

  INSERT INTO public.athlete_links (coach_id, athlete_name, user_id, relationship)
  VALUES (v_invite.coach_id, v_invite.athlete_name, v_uid, v_invite.relationship)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_link_id;

  IF v_link_id IS NULL THEN
    SELECT al.id INTO v_link_id FROM public.athlete_links al
    WHERE al.coach_id = v_invite.coach_id
      AND lower(al.athlete_name) = lower(v_invite.athlete_name)
      AND al.user_id = v_uid;
  END IF;

  UPDATE public.athlete_invites
  SET redeemed_by = v_uid, redeemed_at = now()
  WHERE id = v_invite.id;

  RETURN QUERY
  SELECT v_link_id, v_invite.athlete_name,
         COALESCE((SELECT p.full_name FROM public.profiles p WHERE p.id = v_invite.coach_id), 'Your coach'),
         v_invite.relationship;
END;
$$;

-- Athlete/parent: the athletes they are connected to.
CREATE OR REPLACE FUNCTION public.get_my_linked_athletes()
RETURNS TABLE (link_id uuid, athlete_name text, coach_name text, relationship text, linked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT al.id, al.athlete_name,
         COALESCE(p.full_name, 'Coach'),
         al.relationship, al.created_at
  FROM public.athlete_links al
  LEFT JOIN public.profiles p ON p.id = al.coach_id
  WHERE al.user_id = auth.uid()
  ORDER BY al.athlete_name, al.created_at;
$$;

-- Athlete/parent: all completed-session marks for one linked athlete, with the
-- target time for each mark's segment. Returns nothing unless the link is the
-- caller's own.
CREATE OR REPLACE FUNCTION public.get_linked_athlete_history(p_link_id uuid)
RETURNS TABLE (
  id uuid,
  athlete_name text,
  session_id uuid,
  workout_id uuid,
  group_id uuid,
  group_label text,
  workout_name text,
  distance text,
  rep_number integer,
  segment_index integer,
  time_ms integer,
  target_time_s numeric,
  recorded_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id, a.athlete_name, a.session_id, a.workout_id, a.group_id, a.group_label,
         a.workout_name, a.distance, a.rep_number, a.segment_index, a.time_ms,
         COALESCE(
           NULLIF(w.segments -> COALESCE(a.segment_index, 0) ->> 'targetTime', '')::numeric,
           w.target_time::numeric
         ),
         a.recorded_at
  FROM public.athlete_links al
  JOIN public.athlete_splits a
    ON a.user_id = al.coach_id
   AND lower(a.athlete_name) = lower(al.athlete_name)
  JOIN public.sessions s
    ON s.id = a.session_id
   AND s.status = 'completed'
  LEFT JOIN public.workouts w ON w.id = a.workout_id
  WHERE al.id = p_link_id
    AND al.user_id = auth.uid()
  ORDER BY a.recorded_at DESC;
$$;

-- Coach: who has access to one of their athletes (names/emails so the coach
-- can confirm it is the right person).
CREATE OR REPLACE FUNCTION public.get_athlete_connections(p_athlete_name text)
RETURNS TABLE (link_id uuid, viewer_name text, viewer_email text, relationship text, linked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT al.id, p.full_name, p.email, al.relationship, al.created_at
  FROM public.athlete_links al
  LEFT JOIN public.profiles p ON p.id = al.user_id
  WHERE al.coach_id = auth.uid()
    AND lower(al.athlete_name) = lower(trim(p_athlete_name))
  ORDER BY al.created_at;
$$;

-- Only signed-in users may call these (consistent with the project's
-- "revoke execute from public" hardening).
REVOKE EXECUTE ON FUNCTION public.current_account_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_athlete_invite(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_athlete_invite(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_linked_athletes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_linked_athlete_history(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_athlete_connections(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_account_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_athlete_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_athlete_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_linked_athletes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_linked_athlete_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_athlete_connections(text) TO authenticated;
