-- 018_shared_trail_links.sql
--
-- Anonymously-readable, owner-controlled share links for trails.
-- Each row captures a frozen snapshot of a trail at mint time plus an
-- unguessable URL code. Anonymous viewers read via the
-- `get_shared_trail` RPC (anon-callable, SECURITY DEFINER); owners
-- create/list/revoke via authenticated RPCs in 019_share_rpcs.sql.
--
-- Design notes:
-- * Snapshot is frozen at mint time. Owners editing the source trail
--   does NOT update the share; revoking the share does NOT affect
--   already-imported clones.
-- * Anon role has ZERO direct table access — every public read
--   goes through `get_shared_trail`. RLS on this table is owner-only.
-- * Code is the primary key; once leaked, a code is permanently
--   retired (no reuse after revoke).
-- * `view_count` is `bigint` to absorb anonymous flood writes from
--   `get_shared_trail` (the public read RPC increments it).
--
-- Rollback: see _rollback/018_shared_trail_links.sql

CREATE TABLE public.shared_trail_links (
  code              TEXT PRIMARY KEY,
  trail_id          UUID NOT NULL REFERENCES public.trails(id) ON DELETE CASCADE,
  owner_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Denormalized public metadata captured at mint time.
  label             TEXT NOT NULL,
  root_url          TEXT,
  root_title        TEXT,
  node_count        INTEGER NOT NULL,
  -- Frozen snapshot of the trail's `payload` (NavigationTreeJSON).
  snapshot          JSONB NOT NULL,
  -- Snapshot schema version, in case the sanitizer format evolves.
  snapshot_version  INTEGER NOT NULL DEFAULT 1,
  -- Lifecycle.
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at        TIMESTAMPTZ,
  -- Anon-bumpable counter. bigint absorbs flood writes.
  view_count        BIGINT NOT NULL DEFAULT 0
);

-- Owner enumeration and trail lookup.
CREATE INDEX shared_trail_links_owner_created_idx
  ON public.shared_trail_links (owner_id, created_at DESC);
CREATE INDEX shared_trail_links_trail_id_idx
  ON public.shared_trail_links (trail_id);

ALTER TABLE public.shared_trail_links ENABLE ROW LEVEL SECURITY;

-- Owner-only direct SELECT. INSERT/UPDATE/DELETE flow through the RPCs
-- in 019; no policies are needed for those operations because the RPCs
-- are SECURITY DEFINER. Anon role gets nothing here — they call the
-- definer RPC to read.
CREATE POLICY "select_own" ON public.shared_trail_links
  FOR SELECT USING (owner_id = auth.uid());

COMMENT ON TABLE public.shared_trail_links IS
  'Owner-minted share links with frozen snapshot. Anon reads via get_shared_trail RPC; owner CRUD via 019 RPCs.';
