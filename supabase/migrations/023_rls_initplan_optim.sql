-- 023_rls_initplan_optim.sql
--
-- Performance hardening of RLS policies flagged by Supabase's
-- `auth_rls_initplan` advisor. Two changes per policy:
--
-- 1. Wrap `auth.uid()` as `(SELECT auth.uid())` so Postgres treats it as
--    an InitPlan (computed once per query, cached) instead of a stable
--    function call re-evaluated per row. This makes the policies
--    index-scan-eligible and prevents a class of "why is /trails slow
--    at scale" regressions that show up around 10k+ rows per user.
--
-- 2. Scope every policy `TO authenticated`. Today they default to
--    `TO public`, so the planner walks the USING clause even for anon
--    requests (always a no-op since auth.uid() is NULL, but wasted
--    work). Scoping to authenticated lets the planner skip evaluation
--    entirely for anon traffic — free win.
--
-- Behaviour-preserving: same column references, same row filtering,
-- same anon-deny semantics. No schema change.
--
-- Closes Supabase advisor `auth_rls_initplan` (22 warnings across the
-- public schema; verified via pg_policies query in the security audit).
--
-- Rollback: see _rollback/023_rls_initplan_optim.sql

-- =============================================================================
-- DROP all existing policies first (per project convention — makes the diff
-- easier to scan and avoids "policy already exists" on partial re-apply).
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
-- CREATE replacements: (SELECT auth.uid()) + TO authenticated.
-- =============================================================================

-- users (column is `id`, not `user_id`)
CREATE POLICY "select_own" ON public.users
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY "update_own" ON public.users
  FOR UPDATE
  TO authenticated
  USING      (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "insert_own" ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));

-- trails
CREATE POLICY "select_own" ON public.trails
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert_own" ON public.trails
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update_own" ON public.trails
  FOR UPDATE
  TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "delete_own" ON public.trails
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- devices
CREATE POLICY "select_own" ON public.devices
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert_own" ON public.devices
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update_own" ON public.devices
  FOR UPDATE
  TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "delete_own" ON public.devices
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- device_sessions
CREATE POLICY "select_own" ON public.device_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert_own" ON public.device_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update_own" ON public.device_sessions
  FOR UPDATE
  TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "delete_own" ON public.device_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- account_settings
CREATE POLICY "select_own" ON public.account_settings
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "insert_own" ON public.account_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "update_own" ON public.account_settings
  FOR UPDATE
  TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- user_subscriptions
CREATE POLICY "select_own" ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- billing_checkout_sessions
CREATE POLICY "select_own" ON public.billing_checkout_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- wishlist_leads
CREATE POLICY "select_own" ON public.wishlist_leads
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- extension_device_sessions
CREATE POLICY "select_own" ON public.extension_device_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- oauth_authorization_codes
CREATE POLICY "select_own" ON public.oauth_authorization_codes
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- oauth_refresh_tokens
CREATE POLICY "select_own" ON public.oauth_refresh_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- account_deletion_requests
CREATE POLICY "select_own_deletion_requests" ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- shared_trail_links (column is `owner_id`, not `user_id`)
CREATE POLICY "select_own" ON public.shared_trail_links
  FOR SELECT
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));
