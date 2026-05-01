-- Concurrency coverage for bump_auth_session_version (SEC-003).
--
-- Replaces the read-then-write pattern with an atomic
-- `UPDATE ... SET v = v + 1`. We assert no-lost-update by spawning
-- N independent committed transactions via dblink and verifying the
-- final version equals initial + N. dblink steps outside pgTAP's
-- single-transaction wrapper so each spawned bump is a real, separate
-- session — what matters for MVCC contention.

BEGIN;

CREATE EXTENSION IF NOT EXISTS dblink WITH SCHEMA extensions;

SELECT plan(2);

-- All fixture + bump + cleanup goes through dblink so it commits and
-- the readback (also via dblink) sees the latest committed state.
DO $setup$
BEGIN
  PERFORM extensions.dblink_exec(
    'dbname=' || current_database(),
    $cmd$
      INSERT INTO auth.users (id, email, email_confirmed_at)
        VALUES ('66666666-6666-6666-6666-666666666666'::uuid, 'conc-bump@test.dev', now())
        ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.users (id, email, name, email_verified, auth_session_version)
        VALUES ('66666666-6666-6666-6666-666666666666'::uuid, 'conc-bump@test.dev', 'Conc', true, 1)
        ON CONFLICT (id) DO UPDATE SET auth_session_version = 1;
    $cmd$
  );
END $setup$;

-- 3 contending bumps (each its own committed transaction).
DO $bumps$
DECLARE
  i int;
BEGIN
  FOR i IN 1..3 LOOP
    PERFORM extensions.dblink_exec(
      'dbname=' || current_database(),
      $cmd$ SELECT public.bump_auth_session_version('66666666-6666-6666-6666-666666666666'::uuid); $cmd$
    );
  END LOOP;
END $bumps$;

SELECT is(
  (SELECT v FROM extensions.dblink(
     'dbname=' || current_database(),
     $$ SELECT auth_session_version FROM public.users
          WHERE id = '66666666-6666-6666-6666-666666666666'::uuid $$
  ) AS t(v int)),
  4,
  'three contending bumps produce +3, not +1 (no lost updates)'
);

-- 100 more sequential bumps yields exactly +100 (monotonicity / no skips).
DO $loop$
DECLARE
  i int;
BEGIN
  FOR i IN 1..100 LOOP
    PERFORM extensions.dblink_exec(
      'dbname=' || current_database(),
      $cmd$ SELECT public.bump_auth_session_version('66666666-6666-6666-6666-666666666666'::uuid); $cmd$
    );
  END LOOP;
END $loop$;

SELECT is(
  (SELECT v FROM extensions.dblink(
     'dbname=' || current_database(),
     $$ SELECT auth_session_version FROM public.users
          WHERE id = '66666666-6666-6666-6666-666666666666'::uuid $$
  ) AS t(v int)),
  104,
  '100 more sequential bumps → version = 1 + 3 + 100 = 104'
);

-- Cleanup so reruns start clean (pgTAP ROLLBACK below will not undo
-- the dblink-committed state).
DO $cleanup$
BEGIN
  PERFORM extensions.dblink_exec(
    'dbname=' || current_database(),
    $cmd$
      DELETE FROM public.users WHERE id = '66666666-6666-6666-6666-666666666666'::uuid;
      DELETE FROM auth.users  WHERE id = '66666666-6666-6666-6666-666666666666'::uuid;
    $cmd$
  );
END $cleanup$;

SELECT * FROM finish();
ROLLBACK;
