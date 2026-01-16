CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'user',
    display_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    user_agent text,
    ip text
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS plans (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    tier text NOT NULL,
    price_monthly_cents bigint NOT NULL DEFAULT 0,
    price_yearly_cents bigint NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'USD',
    features text[] NOT NULL DEFAULT '{}',
    limits jsonb,
    highlight boolean NOT NULL DEFAULT false,
    rank integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_active_idx ON plans(active);

CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    plan_id uuid NOT NULL REFERENCES plans(id),
    status text NOT NULL,
    interval text NOT NULL,
    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    trial_ends_at timestamptz,
    canceled_at timestamptz,
    provider text NOT NULL DEFAULT 'stripe_stub',
    provider_subscription_id text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
    amount_cents bigint NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    provider text NOT NULL,
    provider_invoice_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    amount_cents bigint NOT NULL,
    currency text NOT NULL,
    status text NOT NULL,
    provider text NOT NULL,
    provider_payment_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
    id uuid PRIMARY KEY,
    provider text NOT NULL,
    event_id text NOT NULL,
    type text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    status text NOT NULL DEFAULT 'received',
    UNIQUE(provider, event_id)
);

CREATE TABLE IF NOT EXISTS auth_portal_sessions (
    id uuid PRIMARY KEY,
    status text NOT NULL,
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkout_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL REFERENCES plans(id),
    interval text NOT NULL,
    provider text NOT NULL,
    provider_session_id text NOT NULL,
    url text NOT NULL,
    idempotency_key text UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
