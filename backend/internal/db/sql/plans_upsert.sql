INSERT INTO plans (id, name, tier, price_monthly_cents, price_yearly_cents, currency, features, limits, highlight, rank, active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tier = EXCLUDED.tier,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  highlight = EXCLUDED.highlight,
  rank = EXCLUDED.rank,
  active = EXCLUDED.active,
  updated_at = now()
RETURNING id, name, tier, price_monthly_cents, price_yearly_cents, currency, features, limits, highlight, rank, active, created_at, updated_at;
