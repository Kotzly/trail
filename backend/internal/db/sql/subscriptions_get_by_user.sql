SELECT id, user_id, plan_id, status, interval, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, canceled_at, provider, provider_subscription_id, created_at, updated_at
FROM subscriptions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 1;
