-- 022_close_session_rpc_idor.sql
--
-- Close anon-callable RPC IDORs surfaced by the Supabase security audit
-- (tasks/reports/supabase-security-audit.md). Migrations 008/013/015's
-- `REVOKE ALL … FROM PUBLIC` calls did NOT strip Supabase's default
-- role-targeted EXECUTE grant to `anon` — same defect class already
-- fixed in 017/020/021 for the upsert/share RPC families.
--
-- Issue 1 (P0) — `public.bump_auth_session_version(uuid)` is callable by
--   anyone on the internet (the anon key ships in the extension and
--   marketing bundles). It has no `auth.uid() = p_user_id` guard, so an
--   attacker with a victim's UUID can persistently log them out by
--   bumping `users.auth_session_version` (invalidates every active
--   access token). Its original consumer (`apps/account`) has been
--   retired and the repo has zero callers. DROP it.
--
-- Issue 2 (P1) — `public.sync_public_user_from_auth(uuid)` has the same
--   anon-callable IDOR shape; lower impact since the body is an
--   idempotent resync. Add the caller-only guard (`auth.uid() = p_user_id`)
--   and revoke EXECUTE from anon. The extension caller
--   (extension/src/shared/auth/orchestrator/provisioning.ts:72) already
--   passes the caller's own UUID, so no client change is required.
--
-- Issue 3 (P2 DiD) — `public.request_account_deletion()` has anon
--   EXECUTE by default. The body's early `IF auth.uid() IS NULL THEN
--   RAISE` keeps it safe today, but defense-in-depth: revoke anon EXECUTE
--   so a future refactor that drops the early-return doesn't reopen the
--   hole.
--
-- Issue 4 (P2 DiD) — `public.polar_webhook_events` has Supabase's
--   default broad SELECT/INSERT/UPDATE/DELETE grants for anon and
--   authenticated. RLS denies all rows today, but mirror migration 021's
--   share_view_log pattern: explicit `REVOKE ALL FROM PUBLIC, anon,
--   authenticated`. service_role retains full access via Supabase
--   defaults at table creation.
--
-- Rollback: see _rollback/022_close_session_rpc_idor.sql

-- ---------------------------------------------------------------------
-- (1) Drop the orphan session-version bump RPC (Issue 1 — P0)
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.bump_auth_session_version(uuid);

-- ---------------------------------------------------------------------
-- (2) Guard sync_public_user_from_auth — caller-only + anon revoke (P1)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_public_user_from_auth(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'not_authenticated_or_not_self';
  END IF;
  UPDATE public.users
  SET email          = au.email,
      email_verified = (au.email_confirmed_at IS NOT NULL),
      updated_at     = now()
  FROM auth.users au
  WHERE au.id = p_user_id AND public.users.id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_public_user_from_auth(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sync_public_user_from_auth(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.sync_public_user_from_auth IS
  'Copies auth.users.email + email_confirmed_at into public.users for the caller. Caller-only: rejects requests for any UUID other than auth.uid().';

-- ---------------------------------------------------------------------
-- (3) Defense-in-depth: revoke anon EXECUTE on request_account_deletion
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- (4) Tighten polar_webhook_events grants (mirrors 021's share_view_log)
-- ---------------------------------------------------------------------
REVOKE ALL ON TABLE public.polar_webhook_events FROM PUBLIC, anon, authenticated;
-- service_role retains full access (granted at table creation by Supabase defaults).
