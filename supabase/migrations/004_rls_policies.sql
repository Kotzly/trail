-- Row Level Security policies
-- Server queries use service_role (bypasses RLS).
-- RLS adds defense-in-depth against accidental data leakage.

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE polar_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE extension_device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_authorization_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_refresh_tokens ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- users
-- =============================================================================

CREATE POLICY "select_own" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "update_own" ON users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- trails
-- =============================================================================

CREATE POLICY "select_own" ON trails
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON trails
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON trails
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own" ON trails
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- devices
-- =============================================================================

CREATE POLICY "select_own" ON devices
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON devices
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON devices
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own" ON devices
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- device_sessions
-- =============================================================================

CREATE POLICY "select_own" ON device_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON device_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON device_sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own" ON device_sessions
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- account_settings
-- =============================================================================

CREATE POLICY "select_own" ON account_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON account_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON account_settings
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- user_subscriptions (read-only for users; writes via service_role)
-- =============================================================================

CREATE POLICY "select_own" ON user_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- billing_checkout_sessions (read-only for users; writes via service_role)
-- =============================================================================

CREATE POLICY "select_own" ON billing_checkout_sessions
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- polar_webhook_events (service_role only — no user policies)
-- =============================================================================

-- No policies needed. RLS enabled = denied for anon/authenticated.
-- Service role key bypasses RLS for webhook processing.

-- =============================================================================
-- wishlist_leads
-- =============================================================================

-- Public insert (no auth required for lead capture)
CREATE POLICY "insert_anon" ON wishlist_leads
  FOR INSERT WITH CHECK (true);

CREATE POLICY "select_own" ON wishlist_leads
  FOR SELECT USING (user_id = auth.uid());

-- =============================================================================
-- extension_device_sessions
-- =============================================================================

CREATE POLICY "select_own" ON extension_device_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON extension_device_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON extension_device_sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- oauth_authorization_codes
-- =============================================================================

CREATE POLICY "select_own" ON oauth_authorization_codes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON oauth_authorization_codes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON oauth_authorization_codes
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- oauth_refresh_tokens
-- =============================================================================

CREATE POLICY "select_own" ON oauth_refresh_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON oauth_refresh_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON oauth_refresh_tokens
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
