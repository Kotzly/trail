-- Rollback for 019_share_rpcs.sql
DROP FUNCTION IF EXISTS public.import_shared_trail(text);
DROP FUNCTION IF EXISTS public.get_shared_trail(text);
DROP FUNCTION IF EXISTS public.revoke_share_link(text);
DROP FUNCTION IF EXISTS public.list_my_share_links();
DROP FUNCTION IF EXISTS public.create_share_link(uuid, jsonb);
