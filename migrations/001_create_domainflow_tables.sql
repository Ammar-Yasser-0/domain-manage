CREATE TABLE IF NOT EXISTS domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_name TEXT NOT NULL,
  expiration_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT domains_domain_name_not_blank CHECK (
    length(btrim(domain_name)) > 0
    AND domain_name = btrim(domain_name)
    AND domain_name = lower(domain_name)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS domains_domain_name_lower_unique
  ON domains (lower(domain_name));

CREATE INDEX IF NOT EXISTS domains_expiration_date_idx
  ON domains (expiration_date);

CREATE TABLE IF NOT EXISTS renewal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  previous_expiration_date DATE NOT NULL,
  renewed_expiration_date DATE NOT NULL,
  renewal_years SMALLINT NOT NULL CHECK (renewal_years BETWEEN 1 AND 99),
  renewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS renewal_history_domain_renewed_at_idx
  ON renewal_history (domain_id, renewed_at DESC);
