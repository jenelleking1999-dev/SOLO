/*
  # Revoke EXECUTE on SECURITY DEFINER function from PUBLIC

  The function `create_athlete_split_on_update()` is SECURITY DEFINER,
  meaning it runs as the table owner. It should only be invoked by
  its trigger, never directly via the REST API.

  Postgres grants EXECUTE on functions to PUBLIC by default.
  Revoking from PUBLIC removes access for anon + authenticated.
*/

REVOKE EXECUTE ON FUNCTION public.create_athlete_split_on_update() FROM PUBLIC;
