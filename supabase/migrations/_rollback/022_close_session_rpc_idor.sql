-- Rollback for 022_close_session_rpc_idor.sql
--
-- Restores: the dropped bump_auth_session_version RPC (013's original
-- body + 013/015 grants), the unguarded sync_public_user_from_auth body
-- (013's original) with anon EXECUTE re-granted, anon EXECUTE on
-- request_account_deletion (Supabase default), and the broad
-- anon/authenticated table grants on polar_webhook_events.

-- Recreate bump_auth_session_version (matches 013's original definition).
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
REVOKE ALL ON FUNCTION public.bump_auth_session_version(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.bump_auth_session_version(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.bump_auth_session_version IS
  'Atomically increments users.auth_session_version by 1, invalidating every access token issued for that user.';

-- Restore unguarded sync_public_user_from_auth (matches 013's original body).
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
  WHERE au.id = p_user_id AND public.users.id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_public_user_from_auth(uuid) TO anon;

-- Restore anon EXECUTE on request_account_deletion (Supabase default).
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO anon;

-- Restore the default broad grants on polar_webhook_events.
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON TABLE public.polar_webhook_events TO anon, authenticated;
