import { bigint, index, integer, pgTable, text } from "drizzle-orm/pg-core";

// Infrastructure quota only; stores a digest rather than the raw client address.
export const httpRateLimitTable = pgTable("http_rate_limit", {
  key: text("key").primaryKey(),
  hits: integer("hits").notNull(),
  resetAt: bigint("reset_at", { mode: "number" }).notNull(),
}, (table) => [index("http_rate_limit_expiry_idx").on(table.resetAt)]);
