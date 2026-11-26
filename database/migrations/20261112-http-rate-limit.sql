-- Additive infrastructure migration; no business/auth rows are changed.
CREATE TABLE IF NOT EXISTS http_rate_limit (
  key text PRIMARY KEY,
  hits integer NOT NULL CHECK (hits >= 0),
  reset_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS http_rate_limit_expiry_idx ON http_rate_limit (reset_at);
-- Run periodically through the owning database's maintenance scheduler:
-- DELETE FROM http_rate_limit WHERE reset_at < extract(epoch FROM now()) * 1000;
