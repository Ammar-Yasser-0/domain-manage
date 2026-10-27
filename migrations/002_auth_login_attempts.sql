CREATE TABLE IF NOT EXISTS auth_login_attempts (
  bucket_key TEXT PRIMARY KEY CHECK (bucket_key ~ '^[a-f0-9]{64}$'),
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL CHECK (attempt_count > 0),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_login_attempts_updated_at_idx
  ON auth_login_attempts (updated_at);
