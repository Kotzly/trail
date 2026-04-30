-- 017_revoke_upsert_trail_from_anon_authenticated.sql
--
-- Supabase auto-grants EXECUTE on new functions to anon + authenticated via
-- the default schema privileges, which bypasses our REVOKE FROM PUBLIC in
-- 016. Lock upsert_trail down to service_role only; the account API
-- service-role client is the only legitimate caller.
--
-- Closes Supabase advisor lints
--   - 0028 anon_security_definer_function_executable / public.upsert_trail
--   - 0029 authenticated_security_definer_function_executable / public.upsert_trail
--
-- Rollback: see _rollback/017_revoke_upsert_trail_from_anon_authenticated.sql
REVOKE EXECUTE ON FUNCTION public.upsert_trail(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_trail(jsonb) TO service_role;
