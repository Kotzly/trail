-- Column-level UPDATE allow-list on public.users
--
-- Closes v2 P0.1 (review 2026-04-19). The previous "update_own" RLS policy
-- (004_rls_policies.sql:29-31) had no column restriction, so any authenticated
-- client could rewrite their own email, flip email_verified=true without
-- going through the OTP flow, or increment auth_session_version — which is
-- the *sole* server-side mechanism for forced sign-out. That effectively
-- disabled global-sign-out/revocation for determined clients.
--
-- Fix: revoke blanket UPDATE from `authenticated`, then re-grant only the
-- columns that are safe for a user to self-modify. The row-scope guard in
-- the existing "update_own" policy still applies.

REVOKE UPDATE ON public.users FROM authenticated;

GRANT UPDATE (
  name,
  image,
  image_url,
  onboarding_seen_at,
  updated_at
) ON public.users TO authenticated;

COMMENT ON TABLE public.users IS
  'email, email_verified, auth_session_version, email (auth.users) source-of-truth columns: NOT user-writable. Changes go through server SECURITY DEFINER RPCs.';
