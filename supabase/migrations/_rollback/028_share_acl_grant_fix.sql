-- Rollback for 028_share_acl_grant_fix.sql
--
-- Restore the looser 027-era grants (PUBLIC revoked, anon left as
-- Supabase auto-granted). We can't re-add the implicit anon grant
-- exactly, but granting it back explicitly reproduces the observable
-- state.

GRANT EXECUTE ON FUNCTION public.set_share_visibility(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_share_acl(text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_share_acl(text) TO anon, authenticated;
