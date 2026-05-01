-- Fix request_account_deletion() to actually revoke extension sessions
-- and refresh tokens + bump auth_session_version.
--
-- Closes v2 P0.2 (review 2026-04-19). The original RPC (006) only revoked
-- the legacy `device_sessions` rows and did NOT touch
-- `extension_device_sessions` or `oauth_refresh_tokens` — the tables the
-- extension auth path actually reads. After a deletion request, an already-
-- issued refresh token remained valid and the extension kept syncing the
-- soft-deleted data for up to 30 days.
--
-- Also tightens SET search_path to '' (closes P2.7) and drops the
-- undefined_table EXCEPTION block (the table exists; the block was masking
-- potential bugs).

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Soft-delete all trails owned by the caller.
  UPDATE public.trails
    SET deleted_at = now()
    WHERE user_id = v_user_id AND deleted_at IS NULL;

  -- Revoke every active extension device session for the caller. This is
  -- the table the extension actually checks on each authenticated request
  -- (apps/account/src/server/backend/auth/extension-auth.ts).
  UPDATE public.extension_device_sessions
    SET status = 'REVOKED',
        revoked_at = now()
    WHERE user_id = v_user_id AND status = 'ACTIVE';

  -- Revoke every live refresh token. Without this, an extension instance
  -- that has a refresh token would silently obtain new access tokens until
  -- the refresh token's TTL (30 days) regardless of the deletion request.
  UPDATE public.oauth_refresh_tokens
    SET revoked_at = now()
    WHERE user_id = v_user_id AND revoked_at IS NULL;

  -- Bump auth_session_version so any access token still in flight (cached
  -- in the 5-minute JWT window) is rejected by verifyExtensionToken.
  UPDATE public.users
    SET auth_session_version = auth_session_version + 1
    WHERE id = v_user_id;

  -- Keep the legacy device_sessions cleanup for backwards compatibility
  -- with any environment still writing to it.
  UPDATE public.device_sessions
    SET status = 'REVOKED'
    WHERE user_id = v_user_id AND status = 'ACTIVE';

  -- Record the request. A scheduled job reads this table to perform the
  -- hard delete within 30 days.
  INSERT INTO public.account_deletion_requests (user_id)
    VALUES (v_user_id)
    RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;

COMMENT ON FUNCTION public.request_account_deletion() IS
  'Soft-deletes the caller''s trails, revokes all their extension device sessions + refresh tokens, bumps auth_session_version to invalidate access tokens, and records a deletion request for later hard-deletion. Callable only by authenticated users.';
