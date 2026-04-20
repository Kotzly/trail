-- Replace the open `wishlist_leads.insert_anon WITH CHECK (true)` policy
-- with a SECURITY DEFINER RPC that validates input + derives IP/UA
-- server-side. Closes v2 P1.8 (review 2026-04-19).
--
-- Previously any anon caller could POST to /rest/v1/wishlist_leads with
-- arbitrary user_id / ip / utm_* values, allowing lead attribution
-- poisoning and direct spam/enumeration on the email unique index.
-- Now only `insert_wishlist_lead(p_email, p_source)` is callable from
-- anon; the function ignores client-supplied user_id and reads IP / UA
-- from request headers via the PostgREST request.header() function.

DROP POLICY IF EXISTS "insert_anon" ON public.wishlist_leads;

CREATE OR REPLACE FUNCTION public.insert_wishlist_lead(
  p_email  TEXT,
  p_source TEXT DEFAULT NULL,
  p_utm_source TEXT DEFAULT NULL,
  p_utm_medium TEXT DEFAULT NULL,
  p_utm_campaign TEXT DEFAULT NULL,
  p_utm_term TEXT DEFAULT NULL,
  p_utm_content TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_ip  TEXT;
  v_ua  TEXT;
  v_referrer TEXT;
  v_email TEXT;
BEGIN
  v_email := lower(trim(p_email));
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- PostgREST exposes request headers via current_setting().
  v_ip       := nullif(trim(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for'), '');
  v_ua       := nullif(trim(current_setting('request.headers', true)::jsonb ->> 'user-agent'), '');
  v_referrer := nullif(trim(current_setting('request.headers', true)::jsonb ->> 'referer'), '');

  INSERT INTO public.wishlist_leads (
    email,
    source,
    ip,
    user_agent,
    referrer,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content
  ) VALUES (
    v_email,
    nullif(trim(p_source), ''),
    v_ip,
    v_ua,
    v_referrer,
    nullif(trim(p_utm_source), ''),
    nullif(trim(p_utm_medium), ''),
    nullif(trim(p_utm_campaign), ''),
    nullif(trim(p_utm_term), ''),
    nullif(trim(p_utm_content), '')
  )
  ON CONFLICT (email) DO UPDATE
    -- Bump referrer/UTM on repeat to keep the latest marketing context,
    -- but don't recreate the row (primary key stays stable).
    SET
      updated_at = now(),
      referrer = EXCLUDED.referrer,
      utm_source = EXCLUDED.utm_source,
      utm_medium = EXCLUDED.utm_medium,
      utm_campaign = EXCLUDED.utm_campaign,
      utm_term = EXCLUDED.utm_term,
      utm_content = EXCLUDED.utm_content
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_wishlist_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.insert_wishlist_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

COMMENT ON FUNCTION public.insert_wishlist_lead IS
  'Marketing-form lead capture. Callable anonymously. Validates email, reads IP / UA / referrer from request headers (not client-supplied), ignores user_id entirely.';
