-- Rollback for 020_lock_share_rpc_grants.sql
-- Restore the default Supabase grant that this migration revoked.
GRANT EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.list_my_share_links() TO anon;
GRANT EXECUTE ON FUNCTION public.revoke_share_link(text) TO anon;
GRANT EXECUTE ON FUNCTION public.import_shared_trail(text) TO anon;
