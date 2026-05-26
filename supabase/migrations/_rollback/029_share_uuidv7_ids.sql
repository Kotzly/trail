-- Rollback for 029_share_uuidv7_ids.sql
--
-- Drops the client-minted-UUID-v7 signatures and restores the prior
-- server-minted definitions: create_share_link from migration 021
-- (base64url v4 code + retry loop) and import_shared_trail from
-- migration 026 (gen_random_uuid() trail id). Grants mirror 020/021.

DROP FUNCTION IF EXISTS public.create_share_link(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.import_shared_trail(text, uuid);

-- Restore create_share_link(uuid, jsonb) from migration 021.
CREATE OR REPLACE FUNCTION public.create_share_link(
  p_trail_id uuid,
  p_snapshot jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trail public.trails;
  v_code text;
  v_node_count int;
  v_snapshot_size int;
  v_max_size int := 2 * 1024 * 1024; -- 2 MB
  v_max_nodes int := 10000;
  v_attempts int := 0;
BEGIN
  SELECT *
    INTO v_trail
    FROM public.trails
    WHERE id = p_trail_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'share_create_not_owner' USING ERRCODE = 'P0001';
  END IF;

  v_snapshot_size := octet_length(p_snapshot::text);
  IF v_snapshot_size > v_max_size THEN
    RAISE EXCEPTION 'share_create_snapshot_too_large' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_snapshot->'root') = 'object' THEN
    WITH RECURSIVE walk(node) AS (
      SELECT p_snapshot->'root'
      UNION ALL
      SELECT child
      FROM walk,
        jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(walk.node->'children') = 'array'
              THEN walk.node->'children'
            ELSE '[]'::jsonb
          END
        ) AS child
    )
    SELECT count(*)::int INTO v_node_count FROM walk;
  ELSE
    v_node_count := 0;
  END IF;

  IF v_node_count > v_max_nodes THEN
    RAISE EXCEPTION 'share_create_too_many_nodes' USING ERRCODE = 'P0001';
  END IF;

  LOOP
    v_code := rtrim(
      translate(encode(uuid_send(gen_random_uuid()), 'base64'), '+/', '-_'),
      '='
    );
    v_attempts := v_attempts + 1;
    BEGIN
      INSERT INTO public.shared_trail_links (
        code, trail_id, owner_id,
        label, root_url, root_title, node_count,
        snapshot, snapshot_version
      ) VALUES (
        v_code, p_trail_id, auth.uid(),
        v_trail.label, v_trail.root_url, v_trail.root_title, v_node_count,
        p_snapshot, 1
      );
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 5 THEN
        RAISE EXCEPTION 'share_create_code_collision' USING ERRCODE = 'P0001';
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'code', v_code,
    'created_at', now(),
    'label', v_trail.label
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_share_link IS
  'Mint a share link for one of the caller''s trails. Caps snapshot at 2 MB / 10k nodes; node count is derived server-side from the snapshot tree.';

-- Restore import_shared_trail(text) from migration 026.
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
  v_caller text;
  v_allowed boolean;
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

  IF v_share.visibility = 'restricted' THEN
    v_caller := lower(coalesce(auth.email(), ''));
    v_allowed := false;
    IF v_caller <> '' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.shared_trail_acl a
        WHERE a.code = v_share.code AND a.email = v_caller
      ) INTO v_allowed;
    END IF;
    IF NOT v_allowed THEN
      RAISE EXCEPTION 'share_unavailable' USING ERRCODE = 'P0001';
    END IF;
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

REVOKE EXECUTE ON FUNCTION public.import_shared_trail(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.import_shared_trail(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.import_shared_trail IS
  'Clone a shared trail into the caller''s account. Mints a new trail UUID; refuses self-import; respects restricted-share ACLs; atomic against concurrent revoke via FOR SHARE.';
