INSERT INTO plans (id, name, tier, price_monthly_cents, price_yearly_cents, currency, features, limits, highlight, rank, active)
VALUES
  (gen_random_uuid(), 'Free', 'free', 0, 0, 'USD', ARRAY['Basic history', 'Local-only storage'], '{"maxTrees": 5, "maxDevices": 1, "maxHistoryDays": 30}', false, 1, true),
  (gen_random_uuid(), 'Pro', 'pro', 1200, 12000, 'USD', ARRAY['Unlimited trees', 'Cloud sync', 'Priority support'], '{"maxTrees": 999, "maxDevices": 5, "maxHistoryDays": 365}', true, 2, true);
