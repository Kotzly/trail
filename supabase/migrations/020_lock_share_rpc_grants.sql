-- 020_lock_share_rpc_grants.sql
--
-- Tighten ACLs on the share RPCs from 019. Supabase's default privileges
-- auto-GRANT EXECUTE on every public function to anon, authenticated,
-- and service_role; the bare `REVOKE ALL … FROM PUBLIC` in 019 does not
-- strip those role-targeted defaults. Same defect class as
-- 017_revoke_upsert_trail_from_anon_authenticated.sql.
--
-- After this migration:
--   * create_share_link        — authenticated, service_role
--   * list_my_share_links      — authenticated, service_role
--   * revoke_share_link        — authenticated, service_role
--   * import_shared_trail      — authenticated, service_role
--   * get_shared_trail         — anon, authenticated, service_role
--
-- Rollback: see _rollback/020_lock_share_rpc_grants.sql

REVOKE EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_my_share_links() FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_share_link(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.import_shared_trail(text) FROM anon;
