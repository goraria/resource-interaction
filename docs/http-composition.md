# HTTP composition and persistent quota

The host uses the published Principle alpha.10 `createNitroMiddleware`. Native H3 `toResponse`, domain `handleServiceError`, cancellation signal and a host-owned atomic store are supplied explicitly. Route bearer guards and signed webhook handlers are unchanged.

## Deployment prerequisite

Apply `database/migrations/20261128-schema-rate-limit.sql` before deploying. The table uses `count` and `last_request` with an atomic fixed window. Existing counters keep their expiry. Older deployments continue to use the same rows through the previous columns and view. After all deployments and rollback targets use the new contract, apply `database/operations/retire-legacy-rate-limit.sql`. Health probes and valid CORS preflights skip quota storage.

The quota is 100 requests per client key per 60 seconds. A parameterized INSERT ... ON CONFLICT atomically increments or resets the window. Service-specific prefixes keep independent quotas even if services share a database. Only SHA-256 digests of keys are persisted. Existing proxy-header selection is preserved; deployment must ensure the trusted ingress overwrites those headers.

Schedule the expiry DELETE shown in the migration with the owning database maintenance scheduler. Expired rows do not affect quota correctness, but require periodic cleanup to bound storage. No new cron secret/provider was introduced.

`event.context.httpSignal` exposes cancellation for cooperative downstream operations. It does not forcibly cancel database work or undo an already committed mutation.

## Verification

`bun run test`, `bun run typecheck --incremental false` and `bun run build` pass. HTTP tests exercise original signed bytes, size limits, protocol headers, CORS, shared injected quota, unavailable storage and signal propagation. The shared-store test uses a deterministic fixture; it is not a PostgreSQL concurrency test. Cloud migration and actual multi-connection PostgreSQL verification are pending approval.
