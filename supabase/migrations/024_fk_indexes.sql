-- 024_fk_indexes.sql
--
-- Add covering indexes for the three foreign-key constraints in `public`
-- flagged by Supabase advisor `0001_unindexed_foreign_keys`. Without a
-- covering index, every lookup that filters by the FK column does a
-- sequential scan over the whole table, and every cascade DELETE on the
-- parent walks the child table the same way. None of these tables is
-- large today (<100 rows each), but the planner cost is wrong from day
-- one and the indexes are tiny — close it now so the advisor goes quiet
-- and post-launch growth doesn't surface as a sudden p99 spike.
--
--   1. `account_deletion_requests.user_id` (FK → `users.id`) — scanned
--      by the `select_own_deletion_requests` RLS policy on every
--      authenticated request that touches the table.
--
--   2. `trails.device_id` (FK → `devices.id`) — sequential-scanned by
--      the `ON DELETE CASCADE` chain when a device row is removed.
--
--   3. `wishlist_leads.user_id` (FK → `users.id`) — used by the
--      `select_own` RLS policy; low traffic today, but same shape.
--
-- Note on `CONCURRENTLY`: not usable here. Supabase migration files run
-- inside a transaction, and `CREATE INDEX CONCURRENTLY` requires being
-- outside one. The three tables are tiny today, so the brief
-- AccessExclusiveLock during the standard build is fine. A future
-- migration that touches a million-row table should be split into a
-- separate non-transactional step.
--
-- Naming follows the existing `{table}_{column}_idx` convention from
-- `001_create_schema.sql` (e.g. `devices_user_id_idx`).
--
-- Rollback: see _rollback/024_fk_indexes.sql

CREATE INDEX IF NOT EXISTS account_deletion_requests_user_id_idx
  ON public.account_deletion_requests (user_id);

CREATE INDEX IF NOT EXISTS trails_device_id_idx
  ON public.trails (device_id);

CREATE INDEX IF NOT EXISTS wishlist_leads_user_id_idx
  ON public.wishlist_leads (user_id);
