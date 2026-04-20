-- Explicit belt-and-suspenders REVOKE on account_deletion_requests.
--
-- Closes v2 P2.7 (review 2026-04-19). Today INSERT/UPDATE/DELETE work
-- because no policy exists and "no policy = deny" is the PostgREST
-- default — but any future migration that copy-pastes `insert_own` onto
-- this table (a plausible mistake) would silently let users self-record
-- deletion requests or bulk-delete the audit log. Making the denial
-- explicit at the grant level prevents that.

REVOKE INSERT, UPDATE, DELETE ON public.account_deletion_requests
  FROM authenticated, anon;

-- SELECT is intentionally still granted via the select_own_deletion_requests
-- policy from 006.
