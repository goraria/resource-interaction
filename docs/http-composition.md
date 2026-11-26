# HTTP composition and persistent quota

The host uses the published Principle alpha.10 `createNitroMiddleware`. Native H3 `toResponse`, domain `handleServiceError`, cancellation signal and a host-owned atomic store are supplied explicitly. Route bearer guards and signed webhook handlers are unchanged.

## Deployment prerequisite

Apply `database/migrations/20261112-http-rate-limit.sql` to this service's PostgreSQL database **before deploying this code**. This is additive infrastructure DDL, with no business/auth data change. Runtime never creates tables. Missing tables or storage errors return 503; there is no Map fallback. Health probes and valid CORS preflights skip quota storage.

The quota is 100 requests per client key per 60 seconds. A parameterized INSERT ... ON CONFLICT atomically increments or resets the window. Service-specific prefixes keep independent quotas even if services share a database. Only SHA-256 digests of keys are persisted. Existing proxy-header selection is preserved; deployment must ensure the trusted ingress overwrites those headers.

Schedule the expiry DELETE shown in the migration with the owning database maintenance scheduler. Expired rows do not affect quota correctness, but require periodic cleanup to bound storage. No new cron secret/provider was introduced.

`event.context.httpSignal` exposes cancellation for cooperative downstream operations. It does not forcibly cancel database work or undo an already committed mutation.

## Verification

`bun run test`, `bun run typecheck --incremental false` and `bun run build` pass. HTTP tests exercise original signed bytes, size limits, protocol headers, CORS, shared injected quota, unavailable storage and signal propagation. The shared-store test uses a deterministic fixture; it is not a PostgreSQL concurrency test. Cloud migration and actual multi-connection PostgreSQL verification are pending approval.
