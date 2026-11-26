BEGIN;
CREATE TABLE IF NOT EXISTS task_policy_projection (
  id text PRIMARY KEY CHECK (id = 'task'),
  epoch uuid NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  snapshot_id uuid NOT NULL,
  digest text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > issued_at AND expires_at <= issued_at + interval '120 seconds')
);
CREATE TABLE IF NOT EXISTS task_policy_grant (
  page_id uuid NOT NULL,
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 255),
  comment boolean NOT NULL,
  PRIMARY KEY(page_id, subject)
);
CREATE INDEX IF NOT EXISTS task_policy_grant_subject_idx ON task_policy_grant(subject, page_id);
COMMIT;
