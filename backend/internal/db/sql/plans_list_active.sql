SELECT id, name, tier, price_monthly_cents, price_yearly_cents, currency, features, limits, highlight, rank, active, created_at, updated_at
FROM plans
WHERE active = true
ORDER BY rank ASC, created_at ASC;
