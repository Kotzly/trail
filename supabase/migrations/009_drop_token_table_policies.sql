-- Drop INSERT/UPDATE policies on OAuth/session token tables.
--
-- Closes v2 P1.9 + P1.10 (review 2026-04-19). These tables are managed
-- exclusively by the server via the service role. Letting `authenticated`
-- INSERT/UPDATE their own rows lets a logged-in user:
--   * Pre-plant arbitrary refresh-token hashes with long expiry, then
--     present them to /oauth/token and receive a server-signed access
--     token — effectively manufacturing credentials.
--   * Set status='ACTIVE' on a session the server revoked, or rewrite
--     session_version to bypass revocation checks.
--
-- SELECT policies are intentionally NOT dropped — the UI/extension may
-- legitimately list a user's own sessions for "sign out other devices".

DROP POLICY IF EXISTS "insert_own" ON public.oauth_authorization_codes;
DROP POLICY IF EXISTS "update_own" ON public.oauth_authorization_codes;

DROP POLICY IF EXISTS "insert_own" ON public.oauth_refresh_tokens;
DROP POLICY IF EXISTS "update_own" ON public.oauth_refresh_tokens;

DROP POLICY IF EXISTS "insert_own" ON public.extension_device_sessions;
DROP POLICY IF EXISTS "update_own" ON public.extension_device_sessions;

COMMENT ON TABLE public.oauth_authorization_codes IS
  'Server-managed (service role only). INSERT/UPDATE from `authenticated` explicitly revoked to prevent credential manufacturing.';
COMMENT ON TABLE public.oauth_refresh_tokens IS
  'Server-managed (service role only). INSERT/UPDATE from `authenticated` explicitly revoked to prevent credential manufacturing.';
COMMENT ON TABLE public.extension_device_sessions IS
  'Server-managed (service role only). INSERT/UPDATE from `authenticated` explicitly revoked so clients cannot un-revoke their own sessions.';
