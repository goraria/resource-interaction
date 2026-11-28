import { createPostgresRateLimitStore } from "@/modules/principle/postgres-rate-limit";

async function query(text: string, values: unknown[]) {
  const { pool } = await import("@/database");
  return pool.query(text, values);
}

export const rateLimitStore = createPostgresRateLimitStore(
  "resource:http:",
  query,
);
