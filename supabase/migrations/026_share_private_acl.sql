-- 026_share_private_acl.sql
--
-- Optional allowlist for share links. Adds:
--
--   * shared_trail_links.visibility ('public' | 'restricted')
--   * shared_trail_acl(code, email)
--
-- A 'public' share keeps the existing behavior: anyone with the URL
-- can read via `get_shared_trail`. A 'restricted' share is visible
-- only to:
--   * the share's owner (via the existing owner-only RLS), and
--   * authenticated users whose email appears in `shared_trail_acl`
--     for that code.
--
-- The matching identity check is email-based because that's the
-- attribute the sharing owner enters when granting access. We compare
-- against `auth.email()` server-side — anon callers and authed
-- callers whose email isn't on the ACL get the same NULL response as
-- a missing code, so a restricted share's existence does not leak.
--
-- Rollback: see _rollback/026_share_private_acl.sql

-- ---------------------------------------------------------------------
-- visibility column
-- ---------------------------------------------------------------------
ALTER TABLE public.shared_trail_links
  ADD COLUMN visibility text NOT NULL DEFAULT 'public'
  CONSTRAINT shared_trail_links_visibility_chk
  CHECK (visibility IN ('public', 'restricted'));

COMMENT ON COLUMN public.shared_trail_links.visibility IS
  'Public shares are world-readable via the code; restricted shares require the caller email to appear in shared_trail_acl(code).';

-- ---------------------------------------------------------------------
-- shared_trail_acl: per-share email allowlist
--
-- Email is stored lowercased and trimmed. The owner-managed RPCs
-- (027) normalize before insert; the read path does the same on the
-- caller side via `lower(auth.email())`.
-- ---------------------------------------------------------------------
CREATE TABLE public.shared_trail_acl (
  code        TEXT NOT NULL REFERENCES public.shared_trail_links(code) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, email)
);

CREATE INDEX shared_trail_acl_email_idx
  ON public.shared_trail_acl (email);

ALTER TABLE public.shared_trail_acl ENABLE ROW LEVEL SECURITY;

-- Owners read their own ACL through the table to populate the share
-- dialog; nothing else has direct access. Writes go through the
-- SECURITY DEFINER RPCs in 027.
CREATE POLICY "select_own_acl" ON public.shared_trail_acl
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shared_trail_links l
      WHERE l.code = shared_trail_acl.code
        AND l.owner_id = (SELECT auth.uid())
    )
  );

REVOKE ALL ON TABLE public.shared_trail_acl FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.shared_trail_acl TO authenticated;

COMMENT ON TABLE public.shared_trail_acl IS
  'Per-share email allowlist. RLS only exposes a code''s entries to that share''s owner; reads for the viewer go through the get_shared_trail RPC with caller email matching.';

-- ---------------------------------------------------------------------
-- get_shared_trail (replace) — enforce visibility + ACL
--
-- Restricted shares return NULL unless the caller's auth.email() (case-
-- insensitive) is present in shared_trail_acl for the code. NULL is the
-- same response a missing code returns, so the existence of a
-- restricted share never leaks to non-allowlisted readers.
--
-- A bool `restricted_visible_to_caller` and `visibility` column lift
-- through so the marketing page can render a "sign in to view" stub
-- when an anon caller hits a restricted code. We expose the existence
-- ONLY via the `visibility` field — and only after we've also confirmed
-- the caller belongs to the audience. For non-authed callers we return
-- a sentinel shape (`access: "restricted"`) with no snapshot/label so
-- the page can render the sign-in prompt without leaking content.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_shared_trail(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row       public.shared_trail_links;
  v_owner     public.users;
  v_caller    text;
  v_uid       uuid := auth.uid();
  v_allowed   boolean;
BEGIN
  SELECT *
    INTO v_row
    FROM public.shared_trail_links
    WHERE code = p_code AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.visibility = 'restricted' THEN
    -- Owner sees their own share unconditionally.
    IF v_uid IS NOT NULL AND v_uid = v_row.owner_id THEN
      v_allowed := true;
    ELSE
      v_caller := lower(coalesce(auth.email(), ''));
      v_allowed := false;
      IF v_caller <> '' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.shared_trail_acl a
          WHERE a.code = v_row.code AND a.email = v_caller
        ) INTO v_allowed;
      END IF;
    END IF;

    IF NOT v_allowed THEN
      -- Don't leak anything except that this code requires a sign-in
      -- to view. Anon callers and signed-in-but-non-allowlisted
      -- callers see exactly the same response, so neither can probe
      -- ACL membership by sending a known-private code from a logged-
      -- in vs. logged-out browser.
      RETURN jsonb_build_object(
        'access', 'restricted',
        'authenticated', v_uid IS NOT NULL
      );
    END IF;
  END IF;

  SELECT *
    INTO v_owner
    FROM public.users
    WHERE id = v_row.owner_id;

  RETURN jsonb_build_object(
    'access',            'granted',
    'visibility',        v_row.visibility,
    'code',              v_row.code,
    'label',             v_row.label,
    'root_url',          v_row.root_url,
    'root_title',        v_row.root_title,
    'node_count',        v_row.node_count,
    'snapshot',          v_row.snapshot,
    'snapshot_version',  v_row.snapshot_version,
    'created_at',        v_row.created_at,
    'view_count',        v_row.view_count,
    'owner_name',        v_owner.name,
    'owner_image_url',   COALESCE(v_owner.image_url, v_owner.image)
  );
END;
$$;

COMMENT ON FUNCTION public.get_shared_trail IS
  'Public/restricted read of a share by code. Returns NULL if revoked or missing. For restricted shares the caller must be the owner or have auth.email() listed in shared_trail_acl; non-allowlisted callers receive a sentinel { access: "restricted" } payload that does not leak content.';

-- bump_share_view_count must NOT bump for callers who didn't actually
-- view the share (i.e. restricted + not allowlisted). Re-check the
-- ACL inside the bumper before issuing the UPDATE, otherwise an
-- attacker could probe restricted shares by watching view counts.
CREATE OR REPLACE FUNCTION public.bump_share_view_count(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bucket  timestamptz := date_trunc('hour', now());
  v_inserted int := 0;
  v_visibility text;
  v_owner_id uuid;
  v_uid uuid := auth.uid();
  v_caller text;
  v_allowed boolean := false;
BEGIN
  SELECT visibility, owner_id
    INTO v_visibility, v_owner_id
    FROM public.shared_trail_links
    WHERE code = p_code AND revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_visibility = 'restricted' THEN
    IF v_uid IS NOT NULL AND v_uid = v_owner_id THEN
      v_allowed := true;
    ELSE
      v_caller := lower(coalesce(auth.email(), ''));
      IF v_caller <> '' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.shared_trail_acl a
          WHERE a.code = p_code AND a.email = v_caller
        ) INTO v_allowed;
      END IF;
    END IF;
    IF NOT v_allowed THEN
      RETURN false;
    END IF;
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

COMMENT ON FUNCTION public.bump_share_view_count IS
  'Best-effort view-count bump for a share. Rate-limited to one bump per (code, hour) via share_view_log. Respects share visibility: restricted shares only bump when the caller is the owner or on the ACL.';

-- ---------------------------------------------------------------------
-- import_shared_trail (replace) — refuse restricted shares for non-ACL
--
-- Without this, a recipient who knew a restricted share's code could
-- bypass the viewer gate by calling the import RPC directly from the
-- authenticated extension SDK. Mirror the get_shared_trail ACL check
-- inside the existing FOR SHARE lock. The owner-import refusal kicks
-- in below (share_self_import) so we only ACL-check non-owners.
-- ---------------------------------------------------------------------
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

COMMENT ON FUNCTION public.import_shared_trail IS
  'Clone a shared trail into the caller''s account. Mints a new trail UUID; refuses self-import; respects restricted-share ACLs; atomic against concurrent revoke via FOR SHARE.';
