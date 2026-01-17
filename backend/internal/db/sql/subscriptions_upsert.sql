INSERT INTO subscriptions (id, user_id, plan_id, status, interval, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, canceled_at, provider, provider_subscription_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (user_id) DO UPDATE SET
  plan_id = EXCLUDED.plan_id,
  status = EXCLUDED.status,
  interval = EXCLUDED.interval,
  current_period_start = EXCLUDED.current_period_start,
  current_period_end = EXCLUDED.current_period_end,
  cancel_at_period_end = EXCLUDED.cancel_at_period_end,
  trial_ends_at = EXCLUDED.trial_ends_at,
  canceled_at = EXCLUDED.canceled_at,
  provider = EXCLUDED.provider,
  provider_subscription_id = EXCLUDED.provider_subscription_id,
  updated_at = now()
RETURNING id, user_id, plan_id, status, interval, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, canceled_at, provider, provider_subscription_id, created_at, updated_at;
