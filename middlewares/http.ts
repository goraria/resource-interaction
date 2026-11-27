import { createNitroMiddleware } from "@gorth-com/principle/configs/nitro";
import type { RequestRateLimitOptions } from "@gorth-com/principle/modules/rate-limit";
import { toResponse, type H3Event, type Middleware } from "nitro/h3";
import { handleServiceError } from "@/middlewares/01.errors";
import { httpRateLimitStore } from "@/database/http-rate-limit";

interface ServiceHttpOptions {
  maxBodySize: number;
  compress?: boolean;
  cors?: boolean;
  insightProxy?: boolean;
  /** Inject an atomic store; tests may supply a deterministic fixture. */
  store?: RequestRateLimitOptions["store"];
}

export function serviceHttp(options: ServiceHttpOptions): Middleware {
  return createNitroMiddleware<H3Event>({
    maxBodySize: options.maxBodySize,
    compress: options.compress,
    timeoutMs: 30_000,
    cors: options.cors
      ? {
          origins: "*",
          credentials: false,
          allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
          exposeHeaders: [
            "X-Request-Id",
            "Server-Timing",
            "RateLimit-Limit",
            "RateLimit-Remaining",
            "RateLimit-Reset",
          ],
        }
      : undefined,
    rateLimit: {
      limit: 100,
      windowMs: 60_000,
      store: options.store ?? httpRateLimitStore,
      skip: (request) => {
        const { pathname } = new URL(request.url);
        return (
          (request.method === "GET" || request.method === "HEAD") &&
          (pathname === "/" || pathname === "/health")
        );
      },
      // Preserve the host's current proxy policy; never infer an identity from these headers.
      key: (request) =>
        (!options.insightProxy &&
          (request.headers.get("cf-connecting-ip") ??
            request.headers
              .get("x-vercel-forwarded-for")
              ?.split(",")[0]
              ?.trim())) ||
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
    },
    onError: handleServiceError,
    toResponse: (value, event) => toResponse(value, event, event.app?.config),
    onSignal: (event, signal) => {
      event.context.httpSignal = signal;
    },
  });
}
