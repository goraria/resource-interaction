import { createHash } from "node:crypto";
import { createRateLimitStore } from "@gorth-com/principle/modules/rate-limit";

// Host-owned persistence. No connection or DDL at module import; no in-memory fallback.
async function query(text: string, values: unknown[]) {
  const { pool } = await import("@/database");
  return pool.query(text, values);
}
function digest(key: string) {
  return createHash("sha256").update(key).digest("hex");
}
export const httpRateLimitStore = createRateLimitStore({
  prefix: "resource:http:",
  windowMs: 60_000,
  storage: {
    async increment({ key, now, windowMs }) {
      const result = await query(
        `INSERT INTO http_rate_limit AS quota (key, hits, reset_at)
         VALUES ($1, 1, $2::bigint + $3::bigint)
         ON CONFLICT (key) DO UPDATE SET
           hits = CASE WHEN quota.reset_at <= $2 THEN 1 ELSE quota.hits + 1 END,
           reset_at = CASE WHEN quota.reset_at <= $2 THEN $2::bigint + $3::bigint ELSE quota.reset_at END
         RETURNING hits, reset_at`,
        [digest(key), now, windowMs],
      );
      const row = result.rows[0];
      return { totalHits: Number(row.hits), resetAt: Number(row.reset_at) };
    },
    async get(key, now) {
      const result = await query(
        "SELECT hits, reset_at FROM http_rate_limit WHERE key = $1 AND reset_at > $2",
        [digest(key), now],
      );
      const row = result.rows[0];
      return row
        ? { totalHits: Number(row.hits), resetAt: Number(row.reset_at) }
        : undefined;
    },
    async decrement(key) {
      await query(
        "UPDATE http_rate_limit SET hits = greatest(0, hits - 1) WHERE key = $1",
        [digest(key)],
      );
    },
    async resetKey(key) {
      await query("DELETE FROM http_rate_limit WHERE key = $1", [digest(key)]);
    },
  },
});
