import { defineConfig } from "drizzle-kit"
import { databaseUrl } from "@/utils/environment"

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required")
}

export default defineConfig({
  dialect: "postgresql",
  out: "./database/drizzle",
  schema: "./database/schema.ts",
  dbCredentials: { url: databaseUrl },
  schemaFilter: ["public"],
  tablesFilter: ["*"],
  strict: true,
  verbose: true,
})
