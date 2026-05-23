-- Rollback for 024_fk_indexes.sql
--
-- Drops the three covering indexes added for the FKs flagged by
-- Supabase advisor `0001_unindexed_foreign_keys`.

DROP INDEX IF EXISTS public.account_deletion_requests_user_id_idx;
DROP INDEX IF EXISTS public.trails_device_id_idx;
DROP INDEX IF EXISTS public.wishlist_leads_user_id_idx;
