-- Rollback for 015_grant_session_rpcs_service_role.sql
REVOKE EXECUTE ON FUNCTION public.bump_auth_session_version(UUID) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.sync_public_user_from_auth(UUID) FROM service_role;
