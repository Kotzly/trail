-- Sync new Supabase Auth signups to public.users
-- This trigger fires when a user signs up via Supabase Auth (e.g. Google OAuth)
-- and creates a corresponding row in the public.users table.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (
    id, email, name, email_verified, image, image_url,
    created_at, updated_at, auth_session_version
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      COALESCE(NEW.email, '')
    ),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.created_at,
    NEW.updated_at,
    1
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(NULLIF(EXCLUDED.name, ''), public.users.name),
    image = COALESCE(EXCLUDED.image, public.users.image),
    image_url = COALESCE(EXCLUDED.image_url, public.users.image_url),
    email_verified = EXCLUDED.email_verified,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also sync metadata updates (e.g. name/avatar changes via Google)
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.users SET
    email = NEW.email,
    name = COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      public.users.name
    ),
    image = COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', public.users.image),
    image_url = COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', public.users.image_url),
    email_verified = NEW.email_confirmed_at IS NOT NULL,
    updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_updated();
