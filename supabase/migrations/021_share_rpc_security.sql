-- 021_share_rpc_security.sql
--
-- Pre-launch security hardening for the shared-trail feature:
--
-- Issue 1 — `get_shared_trail` used to do an UPDATE on every anon call,
--   which let unauthenticated traffic burn write-locks on a row and
--   trivially mount a write-contention DoS against a known code. Convert
--   the public reader to a pure SELECT and decouple view-count writes
--   via a new `bump_share_view_count` RPC. Best-effort, rate-limited to
--   one bump per code per hour via a `share_view_log` table whose
--   primary key collapses concurrent floods.
--
-- Issue 2 — `create_share_link` previously trusted the caller-supplied
--   `nodeCount` field on the snapshot, so a client could ship 10 000+
--   nodes while declaring `nodeCount: 1` and bypass the structural cap.
--   Derive the count server-side by walking the actual `root → children[]`
--   tree (NavigationTreeJSON shape from extension/src/shared/types/tree.ts),
--   and apply the 10 000 cap to the derived value.
--
-- Issue 3 — Migration 020 only stripped EXECUTE from `anon`, leaving the
--   PUBLIC default privilege intact. Supabase's auto-grant on schema
--   reload could silently re-grant access. Follow the 017 pattern:
--   `REVOKE EXECUTE … FROM PUBLIC` first, then targeted GRANTs to the
--   roles that should keep access.
--
-- Rollback: see _rollback/021_share_rpc_security.sql

-- ---------------------------------------------------------------------
-- share_view_log: rate-limit bucket for anon view-count bumps.
--
-- One row per (code, hour_bucket). Primary key collapses concurrent
-- bumps for the same code within the same hour into a single insert,
-- giving us at most one downstream UPDATE on shared_trail_links.view_count
-- per code per hour regardless of read volume.
--
-- Internal table — only the SECURITY DEFINER `bump_share_view_count`
-- RPC ever writes to it; nothing reads from clients. RLS is enabled with
-- no policies (deny-by-default) to match the project's per-table RLS
-- convention. Direct grants to anon/authenticated are revoked.
-- ---------------------------------------------------------------------
CREATE TABLE public.share_view_log (
  code         TEXT NOT NULL REFERENCES public.shared_trail_links(code) ON DELETE CASCADE,
  hour_bucket  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (code, hour_bucket)
);

ALTER TABLE public.share_view_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.share_view_log FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.share_view_log IS
  'Rate-limit bucket for share view-count bumps. One row per (code, hour). Written only by bump_share_view_count RPC; never read directly.';

-- ---------------------------------------------------------------------
-- get_shared_trail — pure-SELECT replacement (Issue 1)
--
-- Drops the previous side-effect UPDATE. Public reader is now read-only;
-- callers wanting analytics should call `bump_share_view_count` after
-- the fetch (best-effort, fire-and-forget).
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- bump_share_view_count — separate, rate-limited writer (Issue 1)
--
-- Best-effort. Anyone with a code can call it, but the (code, hour_bucket)
-- primary key on share_view_log collapses repeated calls within the
-- same hour into a single bump. A flood of 1 000 reads in 60 seconds
-- still produces exactly one UPDATE on shared_trail_links.view_count.
-- Returns true on actual bump, false on collapsed call.
--
-- Anon-callable: this is the replacement for the side effect that used
-- to live inside get_shared_trail.
-- ---------------------------------------------------------------------
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
  -- Validate the code first so callers cannot fill share_view_log with
  -- arbitrary strings. FK on share_view_log.code -> shared_trail_links.code
  -- would catch this too, but failing fast skips one round-trip.
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

COMMENT ON FUNCTION public.bump_share_view_count IS
  'Best-effort view-count bump for a share. Rate-limited to one bump per (code, hour) via share_view_log primary key. Anon-callable.';

-- ---------------------------------------------------------------------
-- create_share_link — server-side node count derivation (Issue 2)
--
-- Replaces the previous caller-supplied `nodeCount` extraction with a
-- recursive walk over the actual snapshot tree. Shape (from
-- extension/src/shared/types/tree.ts + node.ts):
--   { root: { id, timestamp, data, children: [...] } | null,
--     currentNodeId, nodeCount }
-- The recursive CTE counts every node reachable from `root` regardless
-- of the declared `nodeCount` field, then the 10 000 cap is applied to
-- that derived value.
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

COMMENT ON FUNCTION public.create_share_link IS
  'Mint a share link for one of the caller''s trails. Caps snapshot at 2 MB / 10k nodes; node count is derived server-side from the snapshot tree.';

-- ---------------------------------------------------------------------
-- Grant tightening: REVOKE FROM PUBLIC + explicit GRANTs (Issue 3)
--
-- Previous migration 020 only stripped anon, leaving PUBLIC's default
-- EXECUTE intact. Supabase auto-grant on schema reload could silently
-- re-add anon/authenticated access. Mirror 017's pattern: revoke
-- PUBLIC first, then explicitly grant only what we want.
--
-- get_shared_trail keeps anon access because it is the public reader.
-- bump_share_view_count keeps anon access because it is the public bumper.
-- ---------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_share_link(uuid, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.list_my_share_links() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.list_my_share_links() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.revoke_share_link(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.revoke_share_link(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.import_shared_trail(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.import_shared_trail(text) TO authenticated, service_role;

-- get_shared_trail stays callable by anon (it's the public reader).
-- Mirror the 017 pattern for completeness: REVOKE PUBLIC, then GRANT
-- the three roles we actually want.
REVOKE EXECUTE ON FUNCTION public.get_shared_trail(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_shared_trail(text) TO anon, authenticated, service_role;
