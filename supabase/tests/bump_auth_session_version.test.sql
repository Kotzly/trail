-- pgTAP coverage for bump_auth_session_version (added in 013, granted to
-- service_role in 015). Replaces the read-modify-write pattern so concurrent
-- revocations cannot lose an increment (SEC-003).
--
-- pgTAP runs each test in a single transaction, so true MVCC concurrency
-- requires external orchestration (e.g. pgcat or two psql sessions). Here
-- we assert the atomic single-call semantics and that sequential calls
-- monotonically increment.

BEGIN;

SELECT plan(4);

INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES ('33333333-3333-3333-3333-333333333333'::uuid, 'carol@test.dev', now())
  ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, email, name, email_verified, auth_session_version)
  VALUES ('33333333-3333-3333-3333-333333333333'::uuid, 'carol@test.dev', 'Carol', true, 1)
  ON CONFLICT DO NOTHING;

-- 1. RPC bumps version by 1
SELECT public.bump_auth_session_version('33333333-3333-3333-3333-333333333333'::uuid);
SELECT is(
  (SELECT auth_session_version FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333'::uuid),
  2,
  'first bump → version=2'
);

-- 2. Sequential bumps are monotonic
SELECT public.bump_auth_session_version('33333333-3333-3333-3333-333333333333'::uuid);
SELECT public.bump_auth_session_version('33333333-3333-3333-3333-333333333333'::uuid);
SELECT is(
  (SELECT auth_session_version FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333'::uuid),
  4,
  'three more bumps → version=4'
);

-- 3. Service role can execute (granted in 015)
SET ROLE service_role;
SELECT lives_ok(
  $$ SELECT public.bump_auth_session_version('33333333-3333-3333-3333-333333333333'::uuid) $$,
  'service_role has EXECUTE on bump_auth_session_version'
);
RESET ROLE;

-- 4. Authenticated role can execute (granted in 013)
SET ROLE authenticated;
SELECT lives_ok(
  $$ SELECT public.bump_auth_session_version('33333333-3333-3333-3333-333333333333'::uuid) $$,
  'authenticated has EXECUTE on bump_auth_session_version'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
