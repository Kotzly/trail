-- Cross-user isolation for public.trails.
-- Asserts that RLS prevents user A from reading/mutating user B's trails.

BEGIN;

SELECT plan(4);

INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner@test.dev',  now()),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'other@test.dev',  now())
  ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, email, name)
  VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'owner@test.dev', 'Owner'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'other@test.dev', 'Other')
  ON CONFLICT DO NOTHING;

INSERT INTO public.devices (id, user_id)
  VALUES
    ('owner-device', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)
  ON CONFLICT DO NOTHING;

INSERT INTO public.trails (
  id, user_id, device_id, label, label_source, label_updated_at,
  saved_at, node_count, payload
) VALUES (
  '88888888-8888-8888-8888-888888888888'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'owner-device', 'Owner Trail', 'USER', now(), now(), 0, '{}'::jsonb
) ON CONFLICT DO NOTHING;

-- Impersonate Other, who should not see Owner's trail.
SET LOCAL request.jwt.claims = '{"sub": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
SET LOCAL role = authenticated;

SELECT is(
  (SELECT count(*) FROM public.trails
   WHERE id = '88888888-8888-8888-8888-888888888888'::uuid),
  0::bigint,
  'cross-user SELECT on trails is denied'
);

-- Other can't UPDATE owner's trail.
SELECT is(
  (WITH r AS (
     UPDATE public.trails
       SET label = 'PWNED'
       WHERE id = '88888888-8888-8888-8888-888888888888'::uuid
       RETURNING 1
   ) SELECT count(*) FROM r),
  0::bigint,
  'cross-user UPDATE on trails updates zero rows'
);

-- Other can't DELETE owner's trail.
SELECT is(
  (WITH r AS (
     DELETE FROM public.trails
       WHERE id = '88888888-8888-8888-8888-888888888888'::uuid
       RETURNING 1
   ) SELECT count(*) FROM r),
  0::bigint,
  'cross-user DELETE on trails deletes zero rows'
);

-- Now impersonate Owner and confirm they DO see their trail.
SET LOCAL request.jwt.claims = '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

SELECT is(
  (SELECT count(*) FROM public.trails
   WHERE id = '88888888-8888-8888-8888-888888888888'::uuid),
  1::bigint,
  'owner CAN SELECT own trail'
);

SELECT * FROM finish();
ROLLBACK;
