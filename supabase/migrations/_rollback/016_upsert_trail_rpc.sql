-- Rollback for 016_upsert_trail_rpc.sql
DROP FUNCTION IF EXISTS public.upsert_trail(jsonb);
