-- GDPR-compliant account deletion request.
--
-- Called by the extension's Settings → Data → "Delete account & all data" flow.
-- Soft-deletes all user-owned resources today; a scheduled job (or manual
-- admin step) performs the hard delete within 30 days per the privacy
-- policy.
--
-- Uses SECURITY DEFINER so it can touch tables regardless of RLS, but
-- clamps every UPDATE to auth.uid() so the caller can only delete
-- themselves. Raises if somehow called without a session.

CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own deletion request(s). Insert happens via the
-- SECURITY DEFINER RPC below, not directly.
CREATE POLICY "select_own_deletion_requests" ON account_deletion_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION request_account_deletion()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Soft-delete all trails owned by the caller.
  UPDATE trails
    SET deleted_at = now()
    WHERE user_id = v_user_id AND deleted_at IS NULL;

  -- Revoke active extension device sessions if the table exists in this
  -- environment (safe no-op otherwise).
  BEGIN
    UPDATE device_sessions
      SET status = 'REVOKED'
      WHERE user_id = v_user_id AND status = 'ACTIVE';
  EXCEPTION WHEN undefined_table THEN
    -- older schemas without device_sessions
    NULL;
  END;

  -- Record the request. A scheduled job reads this table to perform the
  -- hard delete within 30 days.
  INSERT INTO account_deletion_requests (user_id)
    VALUES (v_user_id)
    RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION request_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_account_deletion() TO authenticated;

COMMENT ON FUNCTION request_account_deletion() IS
  'Soft-deletes the caller''s trails and records a deletion request for
   later hard-deletion. Callable only by authenticated users.';
