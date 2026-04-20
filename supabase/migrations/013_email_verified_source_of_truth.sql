-- Close the `public.users.email_verified` drift vs `auth.users` and
-- provide an atomic auth_session_version bump.
--
-- Closes v2 P1.11 + P2.8 + P2.9 (review 2026-04-19).
--
-- After migration 005 dropped the auth-sync triggers, `ensurePublicUser`
-- hard-coded `email_verified: true` on every upsert and used
-- `ignoreDuplicates: true`, so subsequent auth changes (email updates,
-- verification revocations) never propagated. This migration:
--   1. Backfills public.users.email_verified from auth.users so the two
--      stay consistent post-migration.
--   2. Adds a SECURITY DEFINER sync_public_user_from_auth(uuid) RPC that
--      the server calls on session refresh to keep them in sync going
--      forward (ensurePublicUser in code will be updated to call it).
--   3. Adds an atomic bump_auth_session_version(uuid) RPC to replace the
--      read-then-write race in apps/account/src/server/backend/oauth.ts.

-- 1. Backfill.
UPDATE public.users u
SET email_verified = (au.email_confirmed_at IS NOT NULL),
    updated_at = now()
FROM auth.users au
WHERE au.id = u.id
  AND u.email_verified IS DISTINCT FROM (au.email_confirmed_at IS NOT NULL);

-- 2. Sync RPC: reads auth.users (authoritative), writes public.users.
CREATE OR REPLACE FUNCTION public.sync_public_user_from_auth(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users
  SET email          = au.email,
      email_verified = (au.email_confirmed_at IS NOT NULL),
      updated_at     = now()
  FROM auth.users au
  WHERE au.id = p_user_id
    AND public.users.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_public_user_from_auth(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_public_user_from_auth(UUID) TO authenticated;

COMMENT ON FUNCTION public.sync_public_user_from_auth IS
  'Copies auth.users.email + email_confirmed_at into public.users. Call after session establish/refresh so email_verified stays authoritative.';

-- 3. Atomic session-version bump. Replaces the read-modify-write pattern
--    in oauth.ts:491-511 that races on concurrent global-sign-outs.
CREATE OR REPLACE FUNCTION public.bump_auth_session_version(p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.users
  SET auth_session_version = auth_session_version + 1,
      updated_at = now()
  WHERE id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.bump_auth_session_version(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_auth_session_version(UUID) TO authenticated;

COMMENT ON FUNCTION public.bump_auth_session_version IS
  'Atomically increments users.auth_session_version by 1, invalidating every access token issued for that user. Use instead of SELECT-then-UPDATE to avoid lost updates on concurrent sign-outs.';
