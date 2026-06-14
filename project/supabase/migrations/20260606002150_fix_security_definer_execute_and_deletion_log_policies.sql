/*
  # Fix SECURITY DEFINER function execute grants + account_deletion_log RLS

  1. SECURITY DEFINER function `create_athlete_split_on_update()`:
    - This function runs as the table owner (SECURITY DEFINER), bypassing RLS
    - It should ONLY be executable by the trigger system, never directly via the REST API
    - Revoke EXECUTE from `anon` and `authenticated` to prevent RPC calls
    - Add GRANT to `service_role` so edge functions can still use it if needed

  2. account_deletion_log table:
    - RLS is enabled but has zero policies, meaning all access is denied
    - This is technically safe (deny-all), but Google Play / App Store reviewers
      and automated security scanners flag "RLS enabled no policy" as a risk
    - Add explicit deny policies with a false condition to satisfy scanners
    - Only service_role should ever access this table
*/

-- 1. Revoke direct execution of the SECURITY DEFINER function from public roles
REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM authenticated;

-- 2. Ensure service_role can still execute it
GRANT EXECUTE ON FUNCTION public.create_athlete_split_on_update() TO service_role;

-- 3. Add explicit restrictive RLS policies on account_deletion_log
-- These policies intentionally evaluate to false so no anon/authenticated user can access
CREATE POLICY "anon_cannot_access_account_deletion_log" ON account_deletion_log
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "authenticated_cannot_access_account_deletion_log" ON account_deletion_log
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
