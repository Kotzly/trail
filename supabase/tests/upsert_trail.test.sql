-- pgTAP coverage for upsert_trail (016) — atomic LWW + tombstone +
-- per-user ownership guard. Replaces read-then-write in trails-sync.ts
-- (DATA-001).
--
-- True race-condition coverage requires concurrent transactions; pgTAP
-- here asserts the single-call semantics that the WHERE predicate
-- protects: newer wins, older skipped, cross-user blocked, tombstone honored.

BEGIN;

SELECT plan(7);

-- Fixtures
INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES
    ('44444444-4444-4444-4444-444444444444'::uuid, 'd@test.dev', now()),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'e@test.dev', now())
  ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, email, name, email_verified, auth_session_version)
  VALUES
    ('44444444-4444-4444-4444-444444444444'::uuid, 'd@test.dev', 'D', true, 1),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'e@test.dev', 'E', true, 1)
  ON CONFLICT DO NOTHING;

INSERT INTO public.devices (id, user_id, status)
  VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '44444444-4444-4444-4444-444444444444'::uuid, 'ACTIVE'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '55555555-5555-5555-5555-555555555555'::uuid, 'ACTIVE')
  ON CONFLICT DO NOTHING;

-- Helper: build a jsonb trail payload
\set trail_id '''cccccccc-cccc-cccc-cccc-cccccccccccc'''

-- 1. INSERT new trail → applied=true
SELECT is(
  (public.upsert_trail(jsonb_build_object(
    'id', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'user_id', '44444444-4444-4444-4444-444444444444',
    'device_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'label', 'first',
    'label_source', 'USER',
    'label_updated_at', '2026-01-01T00:00:00Z',
    'updated_at', '2026-01-01T00:00:00Z',
    'saved_at', '2026-01-01T00:00:00Z',
    'node_count', 1,
    'payload', '{"nodes":[]}'::jsonb
  )))->>'applied',
  'true',
  'new trail INSERT returns applied=true'
);

-- 2. UPDATE with newer updated_at → applied=true
SELECT is(
  (public.upsert_trail(jsonb_build_object(
    'id', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'user_id', '44444444-4444-4444-4444-444444444444',
    'device_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'label', 'second',
    'label_source', 'USER',
    'label_updated_at', '2026-01-02T00:00:00Z',
    'updated_at', '2026-01-02T00:00:00Z',
    'saved_at', '2026-01-02T00:00:00Z',
    'node_count', 2,
    'payload', '{"nodes":[]}'::jsonb
  )))->>'applied',
  'true',
  'newer updated_at wins (LWW)'
);
SELECT is(
  (SELECT label FROM public.trails WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  'second',
  'second update is persisted'
);

-- 3. UPDATE with OLDER updated_at → applied=false, label unchanged
SELECT is(
  (public.upsert_trail(jsonb_build_object(
    'id', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'user_id', '44444444-4444-4444-4444-444444444444',
    'device_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'label', 'stale',
    'label_source', 'USER',
    'label_updated_at', '2025-12-01T00:00:00Z',
    'updated_at', '2025-12-01T00:00:00Z',
    'saved_at', '2025-12-01T00:00:00Z',
    'node_count', 1,
    'payload', '{"nodes":[]}'::jsonb
  )))->>'applied',
  'false',
  'older updated_at is rejected (LWW)'
);
SELECT is(
  (SELECT label FROM public.trails WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  'second',
  'stale write did NOT clobber existing label'
);

-- 4. Cross-user upsert → applied=false (ownership guard)
SELECT is(
  (public.upsert_trail(jsonb_build_object(
    'id', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'user_id', '55555555-5555-5555-5555-555555555555',
    'device_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'label', 'hijack',
    'label_source', 'USER',
    'label_updated_at', '2030-01-01T00:00:00Z',
    'updated_at', '2030-01-01T00:00:00Z',
    'saved_at', '2030-01-01T00:00:00Z',
    'node_count', 99,
    'payload', '{"nodes":[]}'::jsonb
  )))->>'applied',
  'false',
  'cross-user upsert blocked by ownership guard (WHERE user_id = EXCLUDED.user_id)'
);

-- 5. Tombstone protection: newer client write after server tombstone is rejected
UPDATE public.trails
  SET deleted_at = '2030-06-01T00:00:00Z'
  WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;
SELECT is(
  (public.upsert_trail(jsonb_build_object(
    'id', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'user_id', '44444444-4444-4444-4444-444444444444',
    'device_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'label', 'after-tombstone',
    'label_source', 'USER',
    'label_updated_at', '2030-03-01T00:00:00Z',
    'updated_at', '2030-03-01T00:00:00Z',
    'saved_at', '2030-03-01T00:00:00Z',
    'node_count', 5,
    'payload', '{"nodes":[]}'::jsonb
  )))->>'applied',
  'false',
  'client update older than tombstone is rejected'
);

SELECT * FROM finish();
ROLLBACK;
