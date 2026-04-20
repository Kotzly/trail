-- Behaviour test for public.request_account_deletion() after migration 008.
--
-- Before 008, the RPC only revoked the legacy device_sessions table;
-- extension_device_sessions and oauth_refresh_tokens stayed live so the
-- extension kept syncing for up to 30 days after deletion (closes P0.2).
-- This test guards the new behaviour.

BEGIN;

SELECT plan(6);

INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'del@test.dev', now())
  ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, email, name, auth_session_version)
  VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'del@test.dev', 'Del', 1)
  ON CONFLICT DO NOTHING;

INSERT INTO public.devices (id, user_id)
  VALUES ('del-device', 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid)
  ON CONFLICT DO NOTHING;

INSERT INTO public.trails (id, user_id, device_id, label, label_source, label_updated_at, saved_at, node_count, payload)
  VALUES (
    '99999999-9999-9999-9999-999999999999'::uuid,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    'del-device', 'Trail', 'USER', now(), now(), 0, '{}'::jsonb
  )
  ON CONFLICT DO NOTHING;

INSERT INTO public.extension_device_sessions (id, user_id, device_id, status, session_version)
  VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    'del-device', 'ACTIVE', 1
  )
  ON CONFLICT DO NOTHING;

INSERT INTO public.oauth_refresh_tokens (token_hash, user_id, device_session_id, client_id, scope, expires_at)
  VALUES (
    'deadbeefcafe',
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'trail-extension', 'trail.extension',
    now() + interval '30 days'
  )
  ON CONFLICT DO NOTHING;

-- 1. Calling without a session raises not_authenticated.
SET LOCAL role = anon;
SELECT throws_ok(
  $$ SELECT public.request_account_deletion() $$,
  'not_authenticated',
  'RPC refuses unauthenticated callers'
);

-- Impersonate the user.
SET LOCAL request.jwt.claims = '{"sub": "cccccccc-cccc-cccc-cccc-cccccccccccc"}';
SET LOCAL role = authenticated;

-- 2. RPC returns a UUID.
SELECT isnt(
  public.request_account_deletion(),
  NULL,
  'RPC returns a non-null request id'
);

-- 3. The caller's trails are soft-deleted.
SELECT is(
  (SELECT count(*) FROM public.trails
   WHERE user_id = auth.uid() AND deleted_at IS NOT NULL),
  1::bigint,
  'owner trails are soft-deleted'
);

-- Service role can inspect post-RPC state for the remaining checks.
SET LOCAL role = service_role;

-- 4. The caller's extension_device_sessions are REVOKED.
SELECT is(
  (SELECT status FROM public.extension_device_sessions
   WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  'REVOKED',
  'extension_device_sessions marked REVOKED post-RPC'
);

-- 5. The caller's oauth_refresh_tokens have revoked_at set.
SELECT isnt(
  (SELECT revoked_at FROM public.oauth_refresh_tokens
   WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  NULL,
  'oauth_refresh_tokens revoked_at is populated post-RPC'
);

-- 6. auth_session_version bumped.
SELECT is(
  (SELECT auth_session_version FROM public.users
   WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid),
  2::integer,
  'auth_session_version incremented post-RPC'
);

SELECT * FROM finish();
ROLLBACK;
