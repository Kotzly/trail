-- Harden set_updated_at() by fixing search_path = ''.
--
-- Closes v2 P2.5 (review 2026-04-19). The function is SECURITY INVOKER so
-- search-path hijacking is not directly exploitable today, but Supabase
-- linting flags it, and if it's ever flipped to SECURITY DEFINER (easy
-- copy-paste mistake) the trigger becomes a privilege-escalation vector.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
