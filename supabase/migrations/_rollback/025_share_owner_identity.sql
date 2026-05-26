-- Rollback for 025_share_owner_identity.sql
--
-- Restore the get_shared_trail body from 021 (no owner fields).

CREATE OR REPLACE FUNCTION public.get_shared_trail(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.shared_trail_links;
BEGIN
  SELECT *
    INTO v_row
    FROM public.shared_trail_links
    WHERE code = p_code AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'code', v_row.code,
    'label', v_row.label,
    'root_url', v_row.root_url,
    'root_title', v_row.root_title,
    'node_count', v_row.node_count,
    'snapshot', v_row.snapshot,
    'snapshot_version', v_row.snapshot_version,
    'created_at', v_row.created_at,
    'view_count', v_row.view_count
  );
END;
$$;

COMMENT ON FUNCTION public.get_shared_trail IS
  'Public read of a share by code. Returns NULL if revoked or missing. Side-effect free; call bump_share_view_count separately to record a view.';
