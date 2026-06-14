/*
  # Restrict account_deletion_log table grants

  1. Security Changes
    - Revoke all privileges from `anon` and `authenticated` roles on `account_deletion_log`
    - This table should only be accessible by the `service_role` (used by edge functions)
    - RLS is already enabled with no policies (deny-all), but revoking grants adds defense-in-depth

  2. Rationale
    - The account_deletion_log is an audit table written to by the delete-account edge function
    - No end user (anonymous or authenticated) should ever read or write this table directly
    - Only the service_role key (used server-side in edge functions) needs access
*/

REVOKE ALL ON account_deletion_log FROM anon;
REVOKE ALL ON account_deletion_log FROM authenticated;
