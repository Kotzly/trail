-- Rollback for 017: re-grant EXECUTE to anon + authenticated (NOT recommended).
GRANT EXECUTE ON FUNCTION public.upsert_trail(jsonb) TO anon, authenticated;
