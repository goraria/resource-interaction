import { createHash } from "node:crypto";
import { createRateLimitStore } from "@gorth-com/principle/modules/rate-limit";

function digest(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function createPostgresRateLimitStore(
  prefix: string,
  query: (
    text: string,
    values: unknown[],
  ) => Promise<{
    rows: { count: unknown; last_request: unknown }[];
  }>,
  table: "rate_limit" | "commerce.rate_limit" = "rate_limit",
) {
  return createRateLimitStore({
    prefix,
    windowMs: 60_000,
    storage: {
      async increment({ key, now, windowMs }) {
        const result = await query(
          `INSERT INTO ${table} AS quota (key, count, last_request)
         VALUES ($1, 1, $2::bigint)
         ON CONFLICT (key) DO UPDATE SET
           count = CASE WHEN quota.last_request + $3::bigint <= $2 THEN 1 ELSE quota.count + 1 END,
           last_request = CASE WHEN quota.last_request + $3::bigint <= $2 THEN $2 ELSE quota.last_request END
         RETURNING count, last_request`,
          [digest(key), now, windowMs],
        );
        const row = result.rows[0];
        if (!row) throw new Error("rate_limit_increment_failed");
        return {
          totalHits: Number(row.count),
          resetAt: Number(row.last_request) + windowMs,
        };
      },
      async get(key, now) {
        const windowMs = 60_000;
        const result = await query(
          `SELECT count, last_request FROM ${table} WHERE key = $1 AND last_request + $3::bigint > $2`,
          [digest(key), now, windowMs],
        );
        const row = result.rows[0];
        return row
          ? {
              totalHits: Number(row.count),
              resetAt: Number(row.last_request) + windowMs,
            }
          : undefined;
      },
      async decrement(key) {
        await query(
          `UPDATE ${table} SET count = greatest(count - 1, 0) WHERE key = $1`,
          [digest(key)],
        );
      },
      async resetKey(key) {
        await query(`DELETE FROM ${table} WHERE key = $1`, [digest(key)]);
      },
    },
  });
}
