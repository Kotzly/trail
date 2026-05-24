-- 028_share_acl_grant_fix.sql
--
-- Tighten EXECUTE grants on the owner-only RPCs added in 027.
--
-- Supabase auto-grants EXECUTE to `anon` and `authenticated` on every
-- new function created in the `public` schema (the same behavior
-- documented in migration 021's "Issue 3"). Migration 027 only did
-- `REVOKE ... FROM PUBLIC`, which does NOT strip the explicit `anon`
-- grant Supabase added — so set_share_visibility / set_share_acl /
-- list_share_acl ended up callable by `anon`.
--
-- The function bodies are defended (auth.uid() checks reject anon with
-- share_not_owner / empty result), so this was never an actual
-- privilege escalation — but anon should not hold EXECUTE on owner
-- mutation RPCs. Mirror the 021 pattern: REVOKE FROM PUBLIC, anon,
-- authenticated; then GRANT back only the intended roles.
--
-- Rollback: see _rollback/028_share_acl_grant_fix.sql

REVOKE EXECUTE ON FUNCTION public.set_share_visibility(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_share_visibility(text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.set_share_acl(text, text[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.set_share_acl(text, text[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_share_acl(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.list_share_acl(text) TO authenticated, service_role;
