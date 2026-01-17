CREATE TABLE IF NOT EXISTS email_codes (
    id uuid PRIMARY KEY,
    email text NOT NULL,
    purpose text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    consumed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    user_agent text,
    ip text
);
CREATE INDEX IF NOT EXISTS email_codes_lookup_idx ON email_codes (email, purpose, consumed_at);
