import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
  override: false,
  debug: false,
  quiet: true,
});

export const nodeEnv = process.env.NODE_ENV;
export const isProduction = nodeEnv === "production";
export const port = process.env.NITRO_PUBLIC_PORT;

export const authUrl = process.env.NITRO_PUBLIC_AUTH_URL;
export const databaseUrl = process.env.DATABASE_URL;
export const pgPoolMax = process.env.PG_POOL_MAX;

// Telemetry is Vercel-only; do not opt into a separately configured collector.
export const vercelTelemetryEnabled = process.env.VERCEL === "1" &&
  ![process.env.OTEL_EXPORTER_OTLP_ENDPOINT, process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    process.env.OTEL_EXPORTER_OTLP_HEADERS, process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS].some(Boolean)

// Optional operator-owned OAuth client aliases; validated against existing namespaces.
