-- 025_share_owner_identity.sql
--
-- Extend `get_shared_trail` to return the owner's display name and
-- avatar so the public share page at `/s/<code>` can render an
-- attribution header ("Shared by <name>"). The viewer needs to know
-- who minted the link without taking the user's email — email stays
-- private even on public shares.
--
-- Fields added:
--   * owner_name      ← public.users.name (NOT NULL)
--   * owner_image_url ← public.users.image_url ?? public.users.image
--
-- Backward compatibility: additive only. Existing callers that
-- destructure the previous fields keep working; new callers can opt
-- into the owner block. The extension's `fetchSharedTrail` in
-- `extension/src/features/sharing/share-api.ts` simply ignores fields
-- it doesn't read.
--
-- Security: the join goes through SECURITY DEFINER, so RLS on
-- `public.users` doesn't filter it. We expose only `name` and image —
-- never `email`, `auth_session_version`, or any other sensitive
-- column. Names are user-chosen display strings (already shown by the
-- extension on its own sharing surfaces).
--
-- Rollback: see _rollback/025_share_owner_identity.sql

CREATE OR REPLACE FUNCTION public.get_shared_trail(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row   public.shared_trail_links;
  v_owner public.users;
BEGIN
  SELECT *
    INTO v_row
    FROM public.shared_trail_links
    WHERE code = p_code AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Owner lookup is best-effort: a deleted user row (RLS cascade) is
  -- impossible here because the FK on shared_trail_links.owner_id ->
  -- users.id is ON DELETE CASCADE, but defending the lookup keeps the
  -- shape stable if that ever changes.
  SELECT *
    INTO v_owner
    FROM public.users
    WHERE id = v_row.owner_id;

  RETURN jsonb_build_object(
    'code',             v_row.code,
    'label',            v_row.label,
    'root_url',         v_row.root_url,
    'root_title',       v_row.root_title,
    'node_count',       v_row.node_count,
    'snapshot',         v_row.snapshot,
    'snapshot_version', v_row.snapshot_version,
    'created_at',       v_row.created_at,
    'view_count',       v_row.view_count,
    'owner_name',       v_owner.name,
    'owner_image_url',  COALESCE(v_owner.image_url, v_owner.image)
  );
END;
$$;

COMMENT ON FUNCTION public.get_shared_trail IS
  'Public read of a share by code. Returns NULL if revoked or missing. Side-effect free; call bump_share_view_count separately to record a view. Includes owner display name and avatar URL for the attribution header.';
