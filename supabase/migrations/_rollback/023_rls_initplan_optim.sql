-- Rollback for 023_rls_initplan_optim.sql
--
-- Reverses the InitPlan + TO authenticated optimisation by restoring the
-- pre-023 policy definitions: bare `auth.uid()` calls (re-evaluated per
-- row) and no `TO` clause (defaults to `TO public`). Matches the state
-- defined in 004_rls_policies.sql, 005_drop_auth_sync_triggers.sql,
-- 006_account_deletion_rpc.sql, and 018_shared_trail_links.sql.
--
-- Note: migration 009 dropped insert_own/update_own on
-- oauth_authorization_codes, oauth_refresh_tokens, and
-- extension_device_sessions — those are NOT recreated here.

-- =============================================================================
-- DROP the optimised policies first.
-- =============================================================================

-- users
DROP POLICY "select_own" ON public.users;
DROP POLICY "update_own" ON public.users;
DROP POLICY "insert_own" ON public.users;

-- trails
DROP POLICY "select_own" ON public.trails;
DROP POLICY "insert_own" ON public.trails;
DROP POLICY "update_own" ON public.trails;
DROP POLICY "delete_own" ON public.trails;

-- devices
DROP POLICY "select_own" ON public.devices;
DROP POLICY "insert_own" ON public.devices;
DROP POLICY "update_own" ON public.devices;
DROP POLICY "delete_own" ON public.devices;

-- device_sessions
DROP POLICY "select_own" ON public.device_sessions;
DROP POLICY "insert_own" ON public.device_sessions;
DROP POLICY "update_own" ON public.device_sessions;
DROP POLICY "delete_own" ON public.device_sessions;

-- account_settings
DROP POLICY "select_own" ON public.account_settings;
DROP POLICY "insert_own" ON public.account_settings;
DROP POLICY "update_own" ON public.account_settings;

-- user_subscriptions
DROP POLICY "select_own" ON public.user_subscriptions;

-- billing_checkout_sessions
DROP POLICY "select_own" ON public.billing_checkout_sessions;

-- wishlist_leads
DROP POLICY "select_own" ON public.wishlist_leads;

-- extension_device_sessions
DROP POLICY "select_own" ON public.extension_device_sessions;

-- oauth_authorization_codes
DROP POLICY "select_own" ON public.oauth_authorization_codes;

-- oauth_refresh_tokens
DROP POLICY "select_own" ON public.oauth_refresh_tokens;

-- account_deletion_requests
DROP POLICY "select_own_deletion_requests" ON public.account_deletion_requests;

-- shared_trail_links
DROP POLICY "select_own" ON public.shared_trail_links;

-- =============================================================================
-- RECREATE the original pre-023 definitions (bare auth.uid(), no TO clause).
-- =============================================================================

-- users (from 004 + 005)
CREATE POLICY "select_own" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "update_own" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "insert_own" ON public.users
  FOR INSERT WITH CHECK (id = auth.uid());

-- trails (from 004)
CREATE POLICY "select_own" ON public.trails
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON public.trails
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON public.trails
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own" ON public.trails
  FOR DELETE USING (user_id = auth.uid());

-- devices (from 004)
CREATE POLICY "select_own" ON public.devices
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON public.devices
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON public.devices
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own" ON public.devices
  FOR DELETE USING (user_id = auth.uid());

-- device_sessions (from 004)
CREATE POLICY "select_own" ON public.device_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON public.device_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON public.device_sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own" ON public.device_sessions
  FOR DELETE USING (user_id = auth.uid());

-- account_settings (from 004)
CREATE POLICY "select_own" ON public.account_settings
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "insert_own" ON public.account_settings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own" ON public.account_settings
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_subscriptions (from 004)
CREATE POLICY "select_own" ON public.user_subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- billing_checkout_sessions (from 004)
CREATE POLICY "select_own" ON public.billing_checkout_sessions
  FOR SELECT USING (user_id = auth.uid());

-- wishlist_leads (from 004)
CREATE POLICY "select_own" ON public.wishlist_leads
  FOR SELECT USING (user_id = auth.uid());

-- extension_device_sessions (from 004; 009 dropped insert/update_own)
CREATE POLICY "select_own" ON public.extension_device_sessions
  FOR SELECT USING (user_id = auth.uid());

-- oauth_authorization_codes (from 004; 009 dropped insert/update_own)
CREATE POLICY "select_own" ON public.oauth_authorization_codes
  FOR SELECT USING (user_id = auth.uid());

-- oauth_refresh_tokens (from 004; 009 dropped insert/update_own)
CREATE POLICY "select_own" ON public.oauth_refresh_tokens
  FOR SELECT USING (user_id = auth.uid());

-- account_deletion_requests (from 006)
CREATE POLICY "select_own_deletion_requests" ON public.account_deletion_requests
  FOR SELECT USING (user_id = auth.uid());

-- shared_trail_links (from 018)
CREATE POLICY "select_own" ON public.shared_trail_links
  FOR SELECT USING (owner_id = auth.uid());
