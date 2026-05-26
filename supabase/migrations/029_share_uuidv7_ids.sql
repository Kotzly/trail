-- 029_share_uuidv7_ids.sql
--
-- Shared trees switch to client-minted UUID v7 identifiers, replacing
-- the random base64-of-`gen_random_uuid()` (v4) values:
--
--   * create_share_link  — the share *code* (PK of shared_trail_links,
--     the visible /s/<code> URL segment) is now a UUID v7 supplied by
--     the caller, not a server-minted base64url v4 blob.
--   * import_shared_trail — the *new trail id* is now a UUID v7 supplied
--     by the caller, matching every other trail id in the system
--     (normal trails are minted client-side via `uuidv7()` and synced
--     through `upsert_trail`). Previously this was the lone v4 trail id.
--
-- Why client-minted: `extension/src/shared/lib/uuid.ts` `uuidv7()` is
-- the single mint path for v7 ids across the app (see shared/types/
-- ids.ts). PostgreSQL 17 has no native `uuidv7()` (PG18+), so a
-- server-side v7 would mean a second, hand-rolled bit-twiddling source
-- of truth for a security-relevant primitive. We mint on the client —
-- the same trust model already used for every other primary key — and
-- validate the v7 shape server-side.
--
-- Security note: a v7 code carries ~74 random bits + a 48-bit ms
-- timestamp, vs the prior v4's 122 random bits. 2^74 is still far
-- beyond crawlable, and the only thing the embedded timestamp leaks is
-- the share's creation time to someone who already holds the link.
--
-- Both signatures change (drop old, create new), so deploy this
-- migration together with the matching extension build.
--
-- Rollback: see _rollback/029_share_uuidv7_ids.sql

-- ---------------------------------------------------------------------
-- create_share_link  (now: p_trail_id, p_snapshot, p_code)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_share_link(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.create_share_link(
  p_trail_id uuid,
  p_snapshot jsonb,
  p_code     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trail public.trails;
  v_node_count int;
  v_snapshot_size int;
  v_max_size int := 2 * 1024 * 1024; -- 2 MB
  v_max_nodes int := 10000;
BEGIN
  -- Ownership check: caller must own the trail.
  SELECT *
    INTO v_trail
    FROM public.trails
    WHERE id = p_trail_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'share_create_not_owner' USING ERRCODE = 'P0001';
  END IF;

  -- The code is the share's primary key and capability secret. The
  -- extension mints it via the shared `uuidv7()` helper; reject anything
  -- that isn't a well-formed UUID v7 so the /s/<code> space stays
  -- uniform and a buggy client can't persist a malformed key. (Shape
  -- mirrors UUIDv7_RE in shared/types/ids.ts.)
  IF p_code IS NULL OR p_code !~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  THEN
    RAISE EXCEPTION 'share_create_invalid_code' USING ERRCODE = 'P0001';
  END IF;

  -- Structural defense: byte cap.
  v_snapshot_size := octet_length(p_snapshot::text);
  IF v_snapshot_size > v_max_size THEN
    RAISE EXCEPTION 'share_create_snapshot_too_large' USING ERRCODE = 'P0001';
  END IF;

  -- Structural defense: derive node count server-side by walking the
  -- actual tree. Trusting the caller-supplied `nodeCount` lets a client
  -- ship 100 000 nodes with `nodeCount: 1` and bypass the cap. We use
  -- the count from the actual `root → children[]` traversal.
  --
  -- The inner CASE coerces a malformed `children` (string/number/object)
  -- to `'[]'::jsonb` *before* it reaches jsonb_array_elements, which
  -- would otherwise raise `cannot extract elements from a scalar` on
  -- hostile input. The WHERE alone is not enough — the lateral SRF is
  -- evaluated per row before WHERE filtering.
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

  -- Persist. A unique_violation here means a v7 collision (74 random
  -- bits — astronomically unlikely) or a re-submit of the same code;
  -- surface it cleanly so the client can re-mint and retry.
  BEGIN
    INSERT INTO public.shared_trail_links (
      code, trail_id, owner_id,
      label, root_url, root_title, node_count,
      snapshot, snapshot_version
    ) VALUES (
      p_code, p_trail_id, auth.uid(),
      v_trail.label, v_trail.root_url, v_trail.root_title, v_node_count,
      p_snapshot, 1
    );
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'share_create_code_collision' USING ERRCODE = 'P0001';
  END;

  RETURN jsonb_build_object(
    'code', p_code,
    'created_at', now(),
    'label', v_trail.label
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_share_link IS
  'Mint a share link for one of the caller''s trails using a client-supplied UUID v7 code. Caps snapshot at 2 MB / 10k nodes; node count is derived server-side from the snapshot tree.';

-- ---------------------------------------------------------------------
-- import_shared_trail  (now: p_code, p_new_trail_id)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.import_shared_trail(text);

CREATE OR REPLACE FUNCTION public.import_shared_trail(
  p_code         text,
  p_new_trail_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_share public.shared_trail_links;
  v_device_id uuid;
  v_now timestamptz := now();
  v_caller text;
  v_allowed boolean;
BEGIN
  -- The new trail id is minted client-side via `uuidv7()` (the single
  -- v7 mint path). Enforce the v7 version nibble so imported trails
  -- match every other trail id in the system.
  IF p_new_trail_id IS NULL OR substring(p_new_trail_id::text FROM 15 FOR 1) <> '7' THEN
    RAISE EXCEPTION 'share_import_invalid_trail_id' USING ERRCODE = 'P0001';
  END IF;

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
      -- Same surface as a missing/revoked share — the import attempt
      -- must not differentiate "no such code" from "you're not on
      -- the ACL".
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
    p_new_trail_id, auth.uid(), v_device_id,
    v_share.label, 'USER', v_now,
    v_now, v_now, v_now, v_share.node_count,
    v_share.root_url, v_share.root_title, NULL,
    v_share.snapshot, NULL
  );

  RETURN jsonb_build_object(
    'trail_id', p_new_trail_id,
    'label', v_share.label,
    'node_count', v_share.node_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_shared_trail(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.import_shared_trail(text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.import_shared_trail IS
  'Clone a shared trail into the caller''s account under a client-supplied UUID v7 trail id; refuses self-import; respects restricted-share ACLs; atomic against concurrent revoke via FOR SHARE.';
