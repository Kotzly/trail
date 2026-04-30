-- Cross-user safety for upsert_trail (DATA-001).
--
-- The single-call test (upsert_trail.test.sql) already asserts that a
-- naive cross-user upsert returns applied=false. This file adds the
-- multi-session scenario: user A owns a trail, user B (in their own
-- committed transaction) attempts to claim the same id with a newer
-- updated_at. The ownership predicate
--   ON CONFLICT WHERE trails.user_id = EXCLUDED.user_id
-- must reject B's write even though B's updated_at is newer than A's.

BEGIN;

CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

SELECT plan(3);

-- Fixtures: two users, two devices, one trail owned by A.
DO $setup$
BEGIN
  PERFORM extensions.dblink_exec(
    'dbname=' || current_database(),
    $cmd$
      INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
        ('88888888-8888-8888-8888-888888888888'::uuid, 'cross-a@test.dev', now()),
        ('99999999-9999-9999-9999-999999999999'::uuid, 'cross-b@test.dev', now())
        ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.users (id, email, name, email_verified, auth_session_version) VALUES
        ('88888888-8888-8888-8888-888888888888'::uuid, 'cross-a@test.dev', 'A', true, 1),
        ('99999999-9999-9999-9999-999999999999'::uuid, 'cross-b@test.dev', 'B', true, 1)
        ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.devices (id, user_id, status) VALUES
        ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '88888888-8888-8888-8888-888888888888'::uuid, 'ACTIVE'),
        ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, '99999999-9999-9999-9999-999999999999'::uuid, 'ACTIVE')
        ON CONFLICT (id) DO NOTHING;
      DELETE FROM public.trails WHERE id = 'cccccc01-cccc-cccc-cccc-cccccccccccc'::uuid;
    $cmd$
  );
END $setup$;

-- 1. User A inserts the trail.
SELECT is(
  (SELECT v FROM extensions.dblink(
     'dbname=' || current_database(),
     $$
       SELECT (public.upsert_trail(jsonb_build_object(
         'id', 'cccccc01-cccc-cccc-cccc-cccccccccccc',
         'user_id', '88888888-8888-8888-8888-888888888888',
         'device_id', 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
         'label', 'A-owned',
         'label_source', 'USER',
         'label_updated_at', '2026-01-01T00:00:00Z',
         'updated_at', '2026-01-01T00:00:00Z',
         'saved_at', '2026-01-01T00:00:00Z',
         'node_count', 1,
         'payload', '{"nodes":[]}'::jsonb
       )))->>'applied'
     $$
  ) AS t(v text)),
  'true',
  'owner A inserts trail (applied=true)'
);

-- 2. User B (different session, newer updated_at) attempts to claim the
--    same id. Must be rejected: applied=false. updated_at deliberately
--    newer than A's so the ONLY guard is the user_id predicate.
SELECT is(
  (SELECT v FROM extensions.dblink(
     'dbname=' || current_database(),
     $$
       SELECT (public.upsert_trail(jsonb_build_object(
         'id', 'cccccc01-cccc-cccc-cccc-cccccccccccc',
         'user_id', '99999999-9999-9999-9999-999999999999',
         'device_id', 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
         'label', 'B-hijack',
         'label_source', 'USER',
         'label_updated_at', '2030-01-01T00:00:00Z',
         'updated_at', '2030-01-01T00:00:00Z',
         'saved_at', '2030-01-01T00:00:00Z',
         'node_count', 99,
         'payload', '{"nodes":[]}'::jsonb
       )))->>'applied'
     $$
  ) AS t(v text)),
  'false',
  'cross-user claim rejected even with newer updated_at (ownership wins over LWW)'
);

-- 3. Row state is unchanged: A still owns it.
SELECT is(
  (SELECT v::text FROM extensions.dblink(
     'dbname=' || current_database(),
     $$
       SELECT label || '|' || user_id::text FROM public.trails
         WHERE id = 'cccccc01-cccc-cccc-cccc-cccccccccccc'::uuid
     $$
  ) AS t(v text)),
  'A-owned|88888888-8888-8888-8888-888888888888',
  'cross-user attempt did not mutate row (label and user_id unchanged)'
);

DO $cleanup$
BEGIN
  PERFORM extensions.dblink_exec(
    'dbname=' || current_database(),
    $cmd$
      DELETE FROM public.trails  WHERE id = 'cccccc01-cccc-cccc-cccc-cccccccccccc'::uuid;
      DELETE FROM public.devices WHERE id IN (
        'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
        'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
      );
      DELETE FROM public.users   WHERE id IN (
        '88888888-8888-8888-8888-888888888888'::uuid,
        '99999999-9999-9999-9999-999999999999'::uuid
      );
      DELETE FROM auth.users     WHERE id IN (
        '88888888-8888-8888-8888-888888888888'::uuid,
        '99999999-9999-9999-9999-999999999999'::uuid
      );
    $cmd$
  );
END $cleanup$;

SELECT * FROM finish();
ROLLBACK;
