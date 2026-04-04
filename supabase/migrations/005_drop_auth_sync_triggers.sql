-- Remove auth.users → public.users sync triggers.
-- User creation is now handled explicitly in application code via ensurePublicUser().
-- This avoids invisible side effects and makes the data flow traceable.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_user_updated();

-- Allow authenticated users to insert their own row in public.users.
-- Previously the trigger ran as SECURITY DEFINER and bypassed RLS;
-- now the application inserts via the user's own JWT.
CREATE POLICY "insert_own" ON users
  FOR INSERT WITH CHECK (id = auth.uid());
