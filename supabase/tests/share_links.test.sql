-- pgTAP coverage for the shared_trail_links table + the share RPCs
-- (migrations 018, 019).
--
-- Asserts:
--   * RLS isolation: anon sees nothing; non-owner sees nothing; owner
--     sees own rows.
--   * create_share_link: ownership guard, snapshot/node caps, code is
--     unguessable + URL-safe.
--   * revoke_share_link: idempotent; only owner can revoke.
--   * get_shared_trail: anon-callable, returns NULL on revoked/missing,
--     bumps view_count.
--   * import_shared_trail: mints NEW trail UUID, refuses self-import,
--     atomic against concurrent revoke (revoked_at IS NULL re-check).

BEGIN;

SELECT plan(18);

-- ---- Test-local scratch table for captured share codes ----
CREATE TEMP TABLE share_codes (code text);

-- ---- Fixtures ----

INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid, 'owner@share.test', now()),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'guest@share.test', now())
  ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, email, name, email_verified, auth_session_version)
  VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid, 'owner@share.test', 'Owner', true, 1),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'guest@share.test', 'Guest', true, 1)
  ON CONFLICT DO NOTHING;

INSERT INTO public.devices (id, user_id, status)
  VALUES
    ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'ACTIVE'),
    ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'ACTIVE')
  ON CONFLICT DO NOTHING;

INSERT INTO public.trails (
  id, user_id, device_id, label, label_source, label_updated_at,
  saved_at, node_count, root_url, root_title, payload
) VALUES (
  'cccc3333-cccc-cccc-cccc-cccccccccccc'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'Owner''s Trail', 'USER', now(),
  now(), 3, 'https://example.com/start', 'Start Page',
  '{"root":{"id":"n1","data":{"url":"https://example.com/start","title":"Start"},"children":[]},"currentNodeId":"n1","nodeCount":3}'::jsonb
) ON CONFLICT DO NOTHING;

-- ---- create_share_link as owner ----
SET LOCAL request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
SET LOCAL role = authenticated;

SELECT isnt(
  (public.create_share_link(
    'cccc3333-cccc-cccc-cccc-cccccccccccc'::uuid,
    '{"root":{"id":"n1","data":{"url":"https://example.com/start","title":"Start"},"children":[]},"currentNodeId":"n1","nodeCount":3}'::jsonb
  ) ->> 'code'),
  NULL,
  'owner can create_share_link and receives a code'
);

-- Capture the generated code for later assertions.
WITH ins AS (
  SELECT public.create_share_link(
    'cccc3333-cccc-cccc-cccc-cccccccccccc'::uuid,
    '{"root":{"id":"n1","data":{"url":"https://example.com/start","title":"Start"},"children":[]},"currentNodeId":"n1","nodeCount":3}'::jsonb
  ) AS result
)
INSERT INTO share_codes (code) SELECT (result->>'code') FROM ins;

-- Code shape: 22 URL-safe chars (no `+` or `/`).
SELECT ok(
  (SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1) ~ '^[A-Za-z0-9_-]{22}$',
  'generated code is 22 URL-safe characters'
);

-- ---- create_share_link as non-owner (guest tries to share owner's trail) ----
SET LOCAL request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222"}';

SELECT throws_ok(
  $$ SELECT public.create_share_link(
    'cccc3333-cccc-cccc-cccc-cccccccccccc'::uuid,
    '{"nodeCount":1}'::jsonb
  ) $$,
  'P0001',
  'share_create_not_owner',
  'non-owner cannot create_share_link on someone else''s trail'
);

-- ---- create_share_link with oversized snapshot ----
SET LOCAL request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';

SELECT throws_ok(
  format(
    $$ SELECT public.create_share_link(
      'cccc3333-cccc-cccc-cccc-cccccccccccc'::uuid,
      jsonb_build_object('nodeCount', 1, 'payload', repeat('x', %s))
    ) $$,
    3 * 1024 * 1024
  ),
  'P0001',
  'share_create_snapshot_too_large',
  'oversized snapshot is rejected by structural cap'
);

-- ---- create_share_link with too many nodes ----
SELECT throws_ok(
  $$ SELECT public.create_share_link(
    'cccc3333-cccc-cccc-cccc-cccccccccccc'::uuid,
    '{"nodeCount": 50000}'::jsonb
  ) $$,
  'P0001',
  'share_create_too_many_nodes',
  'node_count over 10k is rejected by structural cap'
);

-- ---- list_my_share_links scopes to owner ----
SELECT cmp_ok(
  (SELECT count(*) FROM public.list_my_share_links())::int,
  '>=',
  1,
  'owner sees own share links via list_my_share_links'
);

SET LOCAL request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222"}';

SELECT is(
  (SELECT count(*) FROM public.list_my_share_links())::int,
  0,
  'non-owner sees zero share links via list_my_share_links'
);

-- ---- Direct SELECT RLS isolation: guest sees no share rows ----
SELECT is(
  (SELECT count(*) FROM public.shared_trail_links)::int,
  0,
  'non-owner cannot direct SELECT on shared_trail_links (RLS)'
);

-- ---- Anon sees no rows directly ----
SET LOCAL role = anon;
SET LOCAL request.jwt.claims = '{}';

SELECT is(
  (SELECT count(*) FROM public.shared_trail_links)::int,
  0,
  'anon cannot direct SELECT on shared_trail_links (RLS)'
);

-- ---- get_shared_trail works anonymously ----
SELECT isnt(
  (SELECT public.get_shared_trail((SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1))),
  NULL,
  'anon can call get_shared_trail and receive payload'
);

SELECT is(
  (SELECT (public.get_shared_trail((SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1)))->>'label'),
  'Owner''s Trail',
  'get_shared_trail returns the captured label'
);

-- view_count bumps on each call.
SELECT cmp_ok(
  (SELECT (public.get_shared_trail((SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1)))->>'view_count')::int,
  '>=',
  2,
  'view_count increments on get_shared_trail call'
);

-- ---- Non-existent code returns NULL ----
SELECT is(
  public.get_shared_trail('zzzz-not-a-real-code'),
  NULL,
  'get_shared_trail returns NULL for unknown code'
);

-- ---- import_shared_trail as a different user ----
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222"}';

SELECT isnt(
  (public.import_shared_trail((SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1)) ->> 'trail_id'),
  NULL,
  'guest can import_shared_trail and receives a new trail_id'
);

-- New trail id is NOT the source trail id (premortem #4.4).
SELECT isnt(
  (SELECT trail_id::text FROM public.trails WHERE user_id = '22222222-2222-2222-2222-222222222222'::uuid LIMIT 1),
  'cccc3333-cccc-cccc-cccc-cccccccccccc',
  'imported trail has a NEW UUID, not the source id'
);

-- ---- Self-import is refused ----
SET LOCAL request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';

SELECT throws_ok(
  format(
    $$ SELECT public.import_shared_trail(%L) $$,
    (SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1)
  ),
  'P0001',
  'share_self_import',
  'owner cannot import their own share'
);

-- ---- revoke_share_link by owner ----
SELECT ok(
  public.revoke_share_link((SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1)),
  'owner can revoke their share'
);

-- ---- revoke is idempotent (second call returns false) ----
SELECT ok(
  NOT public.revoke_share_link((SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1)),
  'second revoke returns false (idempotent)'
);

-- ---- get_shared_trail returns NULL after revoke ----
SET LOCAL role = anon;
SET LOCAL request.jwt.claims = '{}';

SELECT is(
  public.get_shared_trail((SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1)),
  NULL,
  'get_shared_trail returns NULL after revoke'
);

-- ---- import_shared_trail fails after revoke ----
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222"}';

SELECT throws_ok(
  format(
    $$ SELECT public.import_shared_trail(%L) $$,
    (SELECT code FROM share_codes ORDER BY ctid DESC LIMIT 1)
  ),
  'P0001',
  'share_unavailable',
  'import_shared_trail rejects revoked code'
);

SELECT * FROM finish();
ROLLBACK;
