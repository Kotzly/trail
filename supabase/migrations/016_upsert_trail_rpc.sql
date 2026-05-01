-- 016_upsert_trail_rpc.sql
--
-- Atomic single-trail upsert with last-write-wins + tombstone protection
-- + per-user ownership guard. Replaces the read-then-write pattern in
-- apps/account/src/server/backend/trails-sync.ts:upsertTrail (DATA-001).
--
-- Returns jsonb { id, applied, updated_at }. `applied=true` if INSERT
-- succeeded or UPDATE WHERE-clause matched; `applied=false` if the
-- server row is newer, deleted, or owned by a different user.
--
-- SECURITY DEFINER + REVOKE FROM PUBLIC + GRANT TO service_role: only
-- the account API service-role client may call this; it has already
-- authenticated the caller and validated that input.userId matches the
-- bearer-token-derived user.
--
-- Rollback: see _rollback/016_upsert_trail_rpc.sql

CREATE OR REPLACE FUNCTION public.upsert_trail(p_trail jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := (p_trail->>'id')::uuid;
  v_user_id uuid := (p_trail->>'user_id')::uuid;
  v_applied boolean := false;
  v_final_updated_at timestamptz;
BEGIN
  IF v_id IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'upsert_trail: id and user_id are required';
  END IF;

  INSERT INTO public.trails (
    id, user_id, device_id, label, label_source, label_updated_at,
    created_at, updated_at, saved_at, node_count,
    root_url, root_title, root_favicon, payload, deleted_at
  )
  VALUES (
    v_id,
    v_user_id,
    (p_trail->>'device_id')::uuid,
    p_trail->>'label',
    (p_trail->>'label_source')::trail_label_source,
    (p_trail->>'label_updated_at')::timestamptz,
    COALESCE((p_trail->>'created_at')::timestamptz, now()),
    (p_trail->>'updated_at')::timestamptz,
    (p_trail->>'saved_at')::timestamptz,
    (p_trail->>'node_count')::int,
    p_trail->>'root_url',
    p_trail->>'root_title',
    p_trail->>'root_favicon',
    (p_trail->'payload'),
    NULLIF(p_trail->>'deleted_at', '')::timestamptz
  )
  ON CONFLICT (id) DO UPDATE
    SET
      device_id = EXCLUDED.device_id,
      label = EXCLUDED.label,
      label_source = EXCLUDED.label_source,
      label_updated_at = EXCLUDED.label_updated_at,
      updated_at = EXCLUDED.updated_at,
      saved_at = EXCLUDED.saved_at,
      node_count = EXCLUDED.node_count,
      root_url = EXCLUDED.root_url,
      root_title = EXCLUDED.root_title,
      root_favicon = EXCLUDED.root_favicon,
      payload = EXCLUDED.payload,
      deleted_at = EXCLUDED.deleted_at
    WHERE trails.user_id = EXCLUDED.user_id
      AND trails.updated_at < EXCLUDED.updated_at
      AND (trails.deleted_at IS NULL OR EXCLUDED.updated_at > trails.deleted_at)
  RETURNING true INTO v_applied;

  -- v_applied is true on successful INSERT or UPDATE; remains false if
  -- the WHERE clause filtered out the UPDATE (e.g. server row newer,
  -- already tombstoned, or owned by a different user).
  v_applied := COALESCE(v_applied, false);

  SELECT updated_at INTO v_final_updated_at FROM public.trails WHERE id = v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'applied', v_applied,
    'updated_at', v_final_updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_trail(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_trail(jsonb) TO service_role;
