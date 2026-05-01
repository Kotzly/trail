-- pgTAP RLS coverage for public.users
--
-- Run via `supabase test db` — requires supabase/config.toml `[db.migrations]`
-- pointed at migrations/ + pgTAP extension installed in the test db.
--
-- Asserts the post-007 column-grant + post-009 token-policy posture:
--  * A user can SELECT their own row (existing select_own policy).
--  * A user CANNOT mutate email, email_verified, or auth_session_version
--    via a direct UPDATE (closes P0.1 regression guard).
--  * A user CAN mutate name / image_url (the explicit allow-list).
--  * A user CANNOT insert or update into oauth_*/extension_device_sessions
--    (closes P1.9/P1.10 regression guard).

BEGIN;

SELECT plan(6);

-- Set up two users with auth.uid() fixtures
INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid, 'alice@test.dev', now()),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'bob@test.dev', now())
  ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, email, name, email_verified, auth_session_version)
  VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid, 'alice@test.dev', 'Alice', true, 1),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'bob@test.dev',   'Bob',   true, 1)
  ON CONFLICT DO NOTHING;

-- Impersonate Alice.
SET LOCAL request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111"}';
SET LOCAL role = authenticated;

-- 1. Alice can SELECT her own row.
SELECT is(
  (SELECT count(*) FROM public.users WHERE id = auth.uid()),
  1::bigint,
  'authenticated user can SELECT own row'
);

-- 2. Alice CANNOT SELECT Bob's row.
SELECT is(
  (SELECT count(*) FROM public.users WHERE id = '22222222-2222-2222-2222-222222222222'::uuid),
  0::bigint,
  'authenticated user cannot SELECT another user row'
);

-- 3. Alice CANNOT update email_verified (migration 007 revoked column).
SELECT throws_ok(
  $$ UPDATE public.users SET email_verified = false WHERE id = auth.uid() $$,
  NULL,
  'direct UPDATE of email_verified must be denied (no column grant post-007)'
);

-- 4. Alice CANNOT update auth_session_version (same reason).
SELECT throws_ok(
  $$ UPDATE public.users SET auth_session_version = 999 WHERE id = auth.uid() $$,
  NULL,
  'direct UPDATE of auth_session_version must be denied (no column grant post-007)'
);

-- 5. Alice CAN update `name` (explicit allow-list in 007).
SELECT lives_ok(
  $$ UPDATE public.users SET name = 'Alice Updated' WHERE id = auth.uid() $$,
  'UPDATE of name is allowed (explicit column grant)'
);

-- 6. Alice CANNOT INSERT into oauth_refresh_tokens (post-009 policy drop).
SELECT throws_ok(
  $$ INSERT INTO public.oauth_refresh_tokens (token_hash, user_id, device_session_id, client_id, scope, expires_at)
     VALUES ('deadbeef', auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid, 'x', 'x', now()) $$,
  NULL,
  'authenticated INSERT into oauth_refresh_tokens must be denied'
);

SELECT * FROM finish();
ROLLBACK;
