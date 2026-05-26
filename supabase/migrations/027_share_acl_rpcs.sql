-- 027_share_acl_rpcs.sql
--
-- Owner-side RPCs for managing a share's visibility + email allowlist:
--   * set_share_visibility(p_code, p_visibility)
--   * set_share_acl(p_code, p_emails)
--   * list_share_acl(p_code)
--
-- All are SECURITY DEFINER and re-check ownership inside the function
-- so the policy isn't strictly necessary — but write paths assume the
-- caller owns the share or they error out with `share_not_owner`.
-- Emails are normalized (trimmed, lowercased) on insert.
--
-- Snapshot semantics: changing visibility or ACL is *immediate*. A
-- viewer mid-page with a now-revoked email loses access on the next
-- RPC call. There is no in-flight revocation primitive — that
-- matches `revoke_share_link`'s "anyone with the link" behavior.
--
-- Rollback: see _rollback/027_share_acl_rpcs.sql

-- ---------------------------------------------------------------------
-- set_share_visibility
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_share_visibility(
  p_code text,
  p_visibility text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows int;
BEGIN
  IF p_visibility NOT IN ('public', 'restricted') THEN
    RAISE EXCEPTION 'share_invalid_visibility' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.shared_trail_links
    SET visibility = p_visibility
    WHERE code = p_code
      AND owner_id = auth.uid()
      AND revoked_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'share_not_owner' USING ERRCODE = 'P0001';
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_share_visibility(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_share_visibility(text, text) TO authenticated;

COMMENT ON FUNCTION public.set_share_visibility IS
  'Owner-only. Flip a share between public and restricted. Errors with share_not_owner if the caller doesn''t own the live share.';

-- ---------------------------------------------------------------------
-- set_share_acl
--
-- Replaces the ACL for a share with the provided email list. The
-- caller-supplied array is trimmed + lowercased + de-duplicated
-- server-side before being persisted. Capped at 100 entries per share
-- so a runaway loop on the client can't mint a giant ACL.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_share_acl(
  p_code text,
  p_emails text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owns boolean;
  v_clean text[];
  v_count int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.shared_trail_links
    WHERE code = p_code AND owner_id = auth.uid() AND revoked_at IS NULL
  ) INTO v_owns;
  IF NOT v_owns THEN
    RAISE EXCEPTION 'share_not_owner' USING ERRCODE = 'P0001';
  END IF;

  -- Normalize + filter + dedup. Reject obvious garbage (no @, empty).
  SELECT COALESCE(
    array_agg(DISTINCT e ORDER BY e),
    ARRAY[]::text[]
  )
  INTO v_clean
  FROM (
    SELECT lower(btrim(unnest)) AS e
    FROM unnest(p_emails)
  ) sub
  WHERE e <> '' AND position('@' in e) > 1;

  v_count := COALESCE(array_length(v_clean, 1), 0);
  IF v_count > 100 THEN
    RAISE EXCEPTION 'share_acl_too_large' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.shared_trail_acl WHERE code = p_code;

  IF v_count > 0 THEN
    INSERT INTO public.shared_trail_acl (code, email)
    SELECT p_code, e FROM unnest(v_clean) AS e;
  END IF;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_share_acl(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_share_acl(text, text[]) TO authenticated;

COMMENT ON FUNCTION public.set_share_acl IS
  'Owner-only. Replace the email allowlist for a share. Normalizes emails, caps at 100 entries, returns the count of accepted emails.';

-- ---------------------------------------------------------------------
-- list_share_acl
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_share_acl(p_code text)
RETURNS TABLE (email text, created_at timestamptz)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT a.email, a.created_at
  FROM public.shared_trail_acl a
  WHERE a.code = p_code
    AND EXISTS (
      SELECT 1 FROM public.shared_trail_links l
      WHERE l.code = p_code AND l.owner_id = auth.uid()
    )
  ORDER BY a.created_at ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_share_acl(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_share_acl(text) TO authenticated;

COMMENT ON FUNCTION public.list_share_acl IS
  'Owner-only enumeration of a share''s ACL. SECURITY INVOKER + the inner ownership check means non-owners see an empty result, not an error.';

-- ---------------------------------------------------------------------
-- Extend list_my_share_links to surface visibility + acl_count, so the
-- extension's ShareDialog can render a single-row summary without a
-- per-share extra round trip.
--
-- DROP first: adding OUT columns changes the function's return row type,
-- which CREATE OR REPLACE cannot do (Postgres 42P13). Nothing server-
-- side depends on this function (client-only RPC), so the drop is safe.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_my_share_links();

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
  view_count bigint,
  visibility text,
  acl_count integer
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    l.code, l.trail_id, l.label, l.root_url, l.root_title,
    l.node_count, l.created_at, l.revoked_at, l.view_count,
    l.visibility,
    COALESCE(
      (SELECT count(*)::int FROM public.shared_trail_acl a WHERE a.code = l.code),
      0
    ) AS acl_count
  FROM public.shared_trail_links l
  WHERE l.owner_id = auth.uid()
  ORDER BY l.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.list_my_share_links() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_share_links() TO authenticated, service_role;

COMMENT ON FUNCTION public.list_my_share_links IS
  'Enumerate share links owned by the caller, with visibility + ACL size. RLS-filtered via SECURITY INVOKER.';
