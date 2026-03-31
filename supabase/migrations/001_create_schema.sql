-- Trail Supabase Schema
-- Converted from Prisma schema to snake_case with UUID user IDs
-- User PK references auth.users(id) for Supabase Auth integration

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE subscription_plan AS ENUM ('FREE', 'PRO', 'TEAMS');
CREATE TYPE subscription_interval AS ENUM ('MONTH', 'YEAR');
CREATE TYPE subscription_status AS ENUM (
  'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE', 'UNKNOWN'
);
CREATE TYPE trail_label_source AS ENUM ('USER', 'AUTO', 'SYSTEM');
CREATE TYPE device_status AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE device_session_ttl_days AS ENUM (
  'DAYS_7', 'DAYS_30', 'DAYS_90', 'DAYS_180', 'DAYS_365'
);
CREATE TYPE billing_provider AS ENUM ('MANUAL', 'NOWPAYMENTS');
CREATE TYPE polar_webhook_event_status AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');
CREATE TYPE wishlist_lead_source AS ENUM ('MARKETING', 'ACCOUNT', 'EXTENSION');
CREATE TYPE extension_device_session_status AS ENUM ('ACTIVE', 'REVOKED');

-- =============================================================================
-- TABLES
-- =============================================================================

-- users: synced from auth.users via trigger, with custom app fields
CREATE TABLE users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  image         TEXT,
  image_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  onboarding_seen_at TIMESTAMPTZ,
  auth_session_version INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT users_email_key UNIQUE (email)
);

-- trails: the core domain entity — saved browser navigation sessions
CREATE TABLE trails (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       UUID NOT NULL,  -- FK added after devices table
  label           TEXT NOT NULL,
  label_source    trail_label_source NOT NULL DEFAULT 'USER',
  label_updated_at TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_at        TIMESTAMPTZ NOT NULL,
  node_count      INTEGER NOT NULL,
  root_url        TEXT,
  root_title      TEXT,
  root_favicon    TEXT,
  payload         JSONB NOT NULL,
  deleted_at      TIMESTAMPTZ
);

-- devices: browser extension installations
CREATE TABLE devices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status            device_status NOT NULL DEFAULT 'ACTIVE',
  device_name       TEXT,
  os                TEXT,
  locale            TEXT,
  timezone          TEXT,
  browser_name      TEXT,
  browser_version   TEXT,
  extension_version TEXT,
  last_seen_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from trails to devices (now that devices table exists)
ALTER TABLE trails
  ADD CONSTRAINT trails_device_id_fkey
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

-- device_sessions: active browser sessions per device
CREATE TABLE device_sessions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  device_id   UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);

-- account_settings: per-user preferences
CREATE TABLE account_settings (
  user_id                UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  device_session_ttl_days device_session_ttl_days NOT NULL DEFAULT 'DAYS_30',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_subscriptions: billing plan state
CREATE TABLE user_subscriptions (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan                  subscription_plan NOT NULL DEFAULT 'FREE',
  status                subscription_status NOT NULL DEFAULT 'UNKNOWN',
  interval              subscription_interval NOT NULL DEFAULT 'MONTH',
  pending_interval      subscription_interval,
  polar_customer_id     TEXT UNIQUE,
  polar_subscription_id TEXT UNIQUE,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT false,
  canceled_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- billing_checkout_sessions: payment flow tracking
CREATE TABLE billing_checkout_sessions (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider                billing_provider NOT NULL,
  order_id                TEXT NOT NULL UNIQUE,
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id                 TEXT NOT NULL,
  interval                TEXT NOT NULL,
  requested_interval      TEXT,
  currency                TEXT NOT NULL,
  amount_cents            INTEGER NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'CREATED',
  payment_status          TEXT,
  nowpayments_invoice_url TEXT,
  nowpayments_payment_id  TEXT,
  last_payload            JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- polar_webhook_events: idempotency tracking for billing webhooks
CREATE TABLE polar_webhook_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  payload      JSONB NOT NULL,
  status       polar_webhook_event_status NOT NULL DEFAULT 'PENDING',
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error        TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- wishlist_leads: waitlist/newsletter signups
CREATE TABLE wishlist_leads (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email        TEXT NOT NULL UNIQUE,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  sources      wishlist_lead_source[] NOT NULL DEFAULT '{}',
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_content  TEXT,
  utm_term     TEXT,
  referrer     TEXT,
  page_path    TEXT,
  user_agent   TEXT,
  ip           TEXT,
  country      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- extension_device_sessions: per-device auth sessions for the Chrome extension
CREATE TABLE extension_device_sessions (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,
  status          extension_device_session_status NOT NULL DEFAULT 'ACTIVE',
  session_version INTEGER NOT NULL DEFAULT 1,
  last_seen_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT extension_device_sessions_user_device_key UNIQUE (user_id, device_id)
);

-- oauth_authorization_codes: PKCE codes for extension auth flow
CREATE TABLE oauth_authorization_codes (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code_hash             TEXT NOT NULL UNIQUE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id             TEXT NOT NULL,
  redirect_uri          TEXT NOT NULL,
  code_challenge        TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  scope                 TEXT,
  state                 TEXT,
  device_id             TEXT,
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- oauth_refresh_tokens: extension refresh tokens with rotation tracking
CREATE TABLE oauth_refresh_tokens (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token_hash           TEXT NOT NULL UNIQUE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_session_id    TEXT NOT NULL REFERENCES extension_device_sessions(id) ON DELETE CASCADE,
  client_id            TEXT NOT NULL,
  scope                TEXT,
  expires_at           TIMESTAMPTZ NOT NULL,
  used_at              TIMESTAMPTZ,
  revoked_at           TIMESTAMPTZ,
  replaced_by_token_id TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- trails (most queried table)
CREATE INDEX trails_user_id_deleted_at_updated_at_id_idx
  ON trails (user_id, deleted_at, updated_at, id);
CREATE INDEX trails_user_id_updated_at_idx
  ON trails (user_id, updated_at);

-- devices
CREATE INDEX devices_user_id_idx ON devices (user_id);

-- device_sessions
CREATE INDEX device_sessions_device_id_idx ON device_sessions (device_id);
CREATE INDEX device_sessions_user_id_idx ON device_sessions (user_id);

-- billing_checkout_sessions
CREATE INDEX billing_checkout_sessions_user_id_idx ON billing_checkout_sessions (user_id);

-- extension_device_sessions
CREATE INDEX extension_device_sessions_user_id_idx ON extension_device_sessions (user_id);

-- oauth_authorization_codes
CREATE INDEX oauth_authorization_codes_user_id_expires_at_idx
  ON oauth_authorization_codes (user_id, expires_at);

-- oauth_refresh_tokens
CREATE INDEX oauth_refresh_tokens_user_id_expires_at_idx
  ON oauth_refresh_tokens (user_id, expires_at);
CREATE INDEX oauth_refresh_tokens_device_session_id_idx
  ON oauth_refresh_tokens (device_session_id);
