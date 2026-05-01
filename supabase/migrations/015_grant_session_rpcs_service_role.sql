-- 015_grant_session_rpcs_service_role.sql
--
-- Grant EXECUTE on the two session-related RPCs added in 013 to
-- service_role so the account API (running with the service-role key)
-- can call them. authenticated already has access via 013.
--
-- Required for SEC-002 (server ensurePublicUser → sync_public_user_from_auth)
-- and SEC-003 (revokeAllExtensionSessionsForUser → bump_auth_session_version).
--
-- Rollback: see _rollback/015_grant_session_rpcs_service_role.sql
GRANT EXECUTE ON FUNCTION public.bump_auth_session_version(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_public_user_from_auth(UUID) TO service_role;
