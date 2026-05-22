-- Rollback for 021_share_rpc_security.sql
--
-- Restores the side-effect UPDATE inside get_shared_trail, the
-- caller-supplied nodeCount path on create_share_link, and the looser
-- 020-style grant pattern. Drops bump_share_view_count + share_view_log.

DROP FUNCTION IF EXISTS public.bump_share_view_count(text);
DROP TABLE IF EXISTS public.share_view_log;

-- Restore the original create_share_link from 019 (caller-supplied nodeCount).
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
  v_max_size int := 2 * 1024 * 1024;
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
  v_node_count := COALESCE((p_snapshot->>'nodeCount')::int, 0);
  IF v_node_count > v_max_nodes THEN
    RAISE EXCEPTION 'share_create_too_many_nodes' USING ERRCODE = 'P0001';
  END IF;
  IF v_node_count < 0 THEN
    RAISE EXCEPTION 'share_create_invalid_node_count' USING ERRCODE = 'P0001';
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

-- Restore the original get_shared_trail from 019 (UPDATE side-effect).
CREATE OR REPLACE FUNCTION public.get_shared_trail(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.shared_trail_links;
BEGIN
  UPDATE public.shared_trail_links
    SET view_count = view_count + 1
    WHERE code = p_code AND revoked_at IS NULL
    RETURNING * INTO v_row;

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

-- Restore the 020-style grants (REVOKE FROM anon only; PUBLIC default
-- left intact, matching the pre-021 state).
GRANT EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_share_links() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_share_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_shared_trail(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_trail(text) TO anon, authenticated;
