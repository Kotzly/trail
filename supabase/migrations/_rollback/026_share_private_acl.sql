-- Rollback for 026_share_private_acl.sql

DROP FUNCTION IF EXISTS public.bump_share_view_count(text);
DROP FUNCTION IF EXISTS public.get_shared_trail(text);
DROP TABLE IF EXISTS public.shared_trail_acl;
ALTER TABLE public.shared_trail_links DROP COLUMN IF EXISTS visibility;

-- Restore get_shared_trail from migration 025 (owner identity, public-only).
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

-- Restore bump_share_view_count from migration 021.
CREATE OR REPLACE FUNCTION public.bump_share_view_count(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket timestamptz := date_trunc('hour', now());
  v_inserted int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shared_trail_links
    WHERE code = p_code AND revoked_at IS NULL
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.share_view_log (code, hour_bucket)
  VALUES (p_code, v_bucket)
  ON CONFLICT (code, hour_bucket) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE public.shared_trail_links
      SET view_count = view_count + 1
      WHERE code = p_code AND revoked_at IS NULL;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_share_view_count(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_share_view_count(text) TO anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_shared_trail(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_trail(text) TO anon, authenticated, service_role;

-- Restore import_shared_trail from migration 019 (no ACL check).
CREATE OR REPLACE FUNCTION public.import_shared_trail(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.shared_trail_links;
  v_new_trail_id uuid := gen_random_uuid();
  v_device_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT *
    INTO v_share
    FROM public.shared_trail_links
    WHERE code = p_code AND revoked_at IS NULL
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'share_unavailable' USING ERRCODE = 'P0001';
  END IF;

  IF v_share.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'share_self_import' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_device_id
    FROM public.devices
    WHERE user_id = auth.uid() AND status = 'ACTIVE'
    ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  IF v_device_id IS NULL THEN
    RAISE EXCEPTION 'share_no_device' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.trails (
    id, user_id, device_id, label, label_source, label_updated_at,
    created_at, updated_at, saved_at, node_count,
    root_url, root_title, root_favicon, payload, deleted_at
  ) VALUES (
    v_new_trail_id, auth.uid(), v_device_id,
    v_share.label, 'USER', v_now,
    v_now, v_now, v_now, v_share.node_count,
    v_share.root_url, v_share.root_title, NULL,
    v_share.snapshot, NULL
  );

  RETURN jsonb_build_object(
    'trail_id', v_new_trail_id,
    'label', v_share.label,
    'node_count', v_share.node_count
  );
END;
$$;
