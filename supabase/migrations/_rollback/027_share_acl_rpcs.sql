-- Rollback for 027_share_acl_rpcs.sql

DROP FUNCTION IF EXISTS public.set_share_visibility(text, text);
DROP FUNCTION IF EXISTS public.set_share_acl(text, text[]);
DROP FUNCTION IF EXISTS public.list_share_acl(text);

-- Restore list_my_share_links from migration 019 (no visibility / acl).
CREATE OR REPLACE FUNCTION public.list_my_share_links()
RETURNS TABLE (
  code text,
  trail_id uuid,
  label text,
  root_url text,
  root_title text,
  node_count integer,
  created_at timestamptz,
  revoked_at timestamptz,
  view_count bigint
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    code, trail_id, label, root_url, root_title,
    node_count, created_at, revoked_at, view_count
  FROM public.shared_trail_links
  WHERE owner_id = auth.uid()
  ORDER BY created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_my_share_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_share_links() TO authenticated, service_role;
