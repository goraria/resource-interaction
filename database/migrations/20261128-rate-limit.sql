-- Keep the old relation available to deployments still using the previous name.
-- The simple view writes through to the same table, including ON CONFLICT.
DO $migration$
BEGIN
  IF to_regclass('http_rate_limit') IS NOT NULL
     AND to_regclass('rate_limit') IS NULL THEN
    ALTER TABLE http_rate_limit RENAME TO rate_limit;
    ALTER INDEX IF EXISTS http_rate_limit_expiry_idx RENAME TO rate_limit_expiry_idx;
  ELSIF EXISTS (
    SELECT FROM pg_class
    WHERE oid = to_regclass('http_rate_limit') AND relkind <> 'v'
  ) THEN
    RAISE EXCEPTION 'Both quota tables exist; reconcile them before renaming';
  END IF;
END
$migration$;

CREATE TABLE IF NOT EXISTS rate_limit (
  key text PRIMARY KEY,
  hits integer NOT NULL CHECK (hits >= 0),
  reset_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_limit_expiry_idx ON rate_limit (reset_at);

CREATE OR REPLACE VIEW http_rate_limit WITH (security_invoker = true) AS
SELECT key, hits, reset_at FROM rate_limit;
