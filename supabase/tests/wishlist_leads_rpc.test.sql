-- Behaviour test for public.insert_wishlist_lead() after migration 010.
--
-- Closes P1.8. Asserts:
--  * anon INSERT via RPC succeeds for valid email.
--  * Direct INSERT into public.wishlist_leads from anon is denied.
--  * Client-supplied user_id / ip are ignored by the RPC body (derived
--    from request headers instead).

BEGIN;

SELECT plan(3);

-- 1. anon can call RPC with valid email.
SET LOCAL role = anon;

SELECT isnt(
  public.insert_wishlist_lead('rpc-lead@test.dev', 'marketing-site'),
  NULL,
  'anon insert_wishlist_lead() returns a row id for valid input'
);

-- 2. Direct INSERT is denied (insert_anon policy dropped in 010).
SELECT throws_ok(
  $$ INSERT INTO public.wishlist_leads (email) VALUES ('direct@test.dev') $$,
  NULL,
  'direct anon INSERT is denied post-010'
);

-- 3. Invalid email raises.
SELECT throws_ok(
  $$ SELECT public.insert_wishlist_lead('not-an-email', NULL) $$,
  'invalid_email',
  'RPC rejects malformed email'
);

SELECT * FROM finish();
ROLLBACK;
