UPDATE subscriptions
SET status = 'canceled', cancel_at_period_end = true, canceled_at = $2, updated_at = now()
WHERE user_id = $1
RETURNING id, user_id, plan_id, status, interval, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, canceled_at, provider, provider_subscription_id, created_at, updated_at;
