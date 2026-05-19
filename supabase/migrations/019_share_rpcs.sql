-- 019_share_rpcs.sql
--
-- Four SECURITY DEFINER RPCs for the shared-trail feature, plus a
-- public anon-callable read RPC. See 018_shared_trail_links.sql for the
-- table definition.
--
-- All functions lock `search_path = public, pg_temp` and have explicit
-- REVOKE FROM PUBLIC + targeted GRANTs. Anon role can only call
-- `get_shared_trail`; authenticated can call create/list/revoke/import.
--
-- Server-side defenses:
-- * `create_share_link` caps snapshot size at 2 MB and node count at
--   10 000 (premortem #5). Client (extension) is expected to perform
--   URL-fragment / token-param / bidi-override sanitization on the
--   snapshot before submission — `extension/src/features/sharing/sanitize.ts`.
-- * `import_shared_trail` uses `SELECT … FOR SHARE` + `revoked_at IS
--   NULL` to make import atomic against concurrent revoke (premortem
--   #10), refuses self-import, and mints a NEW trail UUID (never
--   reuses the source trail id — premortem #4.4).
-- * `get_shared_trail` bumps `view_count` in the same call. Returns
--   only the public-safe columns (no email, no owner_id leak).
--
-- Rollback: see _rollback/019_share_rpcs.sql

-- ---------------------------------------------------------------------
-- create_share_link
-- ---------------------------------------------------------------------
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
  -- Ownership check: caller must own the trail.
  SELECT *
    INTO v_trail
    FROM public.trails
    WHERE id = p_trail_id AND user_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'share_create_not_owner' USING ERRCODE = 'P0001';
  END IF;

  -- Structural defenses.
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

  -- Generate unguessable URL-safe code (22 chars, ~128 bits). Retry
  -- on collision; failure after 5 attempts is statistically impossible
  -- with 128-bit entropy but defended explicitly.
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

REVOKE ALL ON FUNCTION public.create_share_link(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.create_share_link IS
  'Mint a share link for one of the caller''s trails. Caps snapshot at 2MB / 10k nodes. Client is responsible for URL/title sanitization before calling.';

-- ---------------------------------------------------------------------
-- list_my_share_links
-- ---------------------------------------------------------------------
-- SECURITY INVOKER so the owner_id = auth.uid() RLS policy applies
-- naturally; no need to filter inside the function.
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

REVOKE ALL ON FUNCTION public.list_my_share_links() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_share_links() TO authenticated;

COMMENT ON FUNCTION public.list_my_share_links IS
  'Enumerate share links owned by the caller. RLS-filtered via SECURITY INVOKER.';

-- ---------------------------------------------------------------------
-- revoke_share_link
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_share_link(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows int;
BEGIN
  UPDATE public.shared_trail_links
    SET revoked_at = now()
    WHERE code = p_code
      AND owner_id = auth.uid()
      AND revoked_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_share_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_share_link(text) TO authenticated;

COMMENT ON FUNCTION public.revoke_share_link IS
  'Soft-revoke a share by setting revoked_at. Idempotent: returns true on first call, false on subsequent.';

-- ---------------------------------------------------------------------
-- get_shared_trail
-- ---------------------------------------------------------------------
-- Anon-callable. Returns only public-safe columns. Bumps view_count
-- atomically as a side effect. SECURITY DEFINER so we can read
-- past the owner-only RLS policy and update view_count.
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

REVOKE ALL ON FUNCTION public.get_shared_trail(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_trail(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_shared_trail IS
  'Public read of a share by code. Returns NULL if revoked or missing. Increments view_count as a side effect.';

-- ---------------------------------------------------------------------
-- import_shared_trail
-- ---------------------------------------------------------------------
-- Clones a share's snapshot into the caller's trails. Atomic against
-- concurrent revoke via FOR SHARE + revoked_at IS NULL re-check.
-- Refuses self-import. Mints a NEW trail UUID — never preserves
-- source id (premortem #4.4).
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
  -- Lock the share row briefly so a concurrent revoke can't sneak in.
  SELECT *
    INTO v_share
    FROM public.shared_trail_links
    WHERE code = p_code AND revoked_at IS NULL
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'share_unavailable' USING ERRCODE = 'P0001';
  END IF;

  -- Refuse self-import.
  IF v_share.owner_id = auth.uid() THEN
    RAISE EXCEPTION 'share_self_import' USING ERRCODE = 'P0001';
  END IF;

  -- Importer must have at least one device registered. Pick the most
  -- recent one; the extension's `ensureDeviceRegistered` keeps this
  -- fresh per sign-in.
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

REVOKE ALL ON FUNCTION public.import_shared_trail(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_shared_trail(text) TO authenticated;

COMMENT ON FUNCTION public.import_shared_trail IS
  'Clone a shared trail into the caller''s account. Mints new trail UUID; refuses self-import; atomic against concurrent revoke via FOR SHARE.';
