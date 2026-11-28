import { createNitroMiddleware } from "@gorth-com/principle/configs/nitro";
import type { RequestRateLimitOptions } from "@gorth-com/principle/modules/rate-limit";
import { toResponse, type H3Event, type Middleware } from "nitro/h3";

export interface ServiceHttpOptions {
  maxBodySize: number;
  compress?: boolean;
  cors?: boolean;
  insightProxy?: boolean;
  proxyPolicy?: "vercel";
  timeoutMs?: number | false;
  secureHeaders?: Record<string, string>;
  /** Inject an atomic store; tests may supply a deterministic fixture. */
  store?: RequestRateLimitOptions["store"];
}

export function createServiceHttp(
  options: ServiceHttpOptions,
  store: RequestRateLimitOptions["store"],
  onError: NonNullable<
    Parameters<typeof createNitroMiddleware<H3Event>>[0]["onError"]
  >,
): Middleware {
  return createNitroMiddleware<H3Event>({
    maxBodySize: options.maxBodySize,
    compress: options.compress,
    timeoutMs: options.timeoutMs ?? 30_000,
    ...(options.secureHeaders ? { secureHeaders: options.secureHeaders } : {}),
    cors: options.cors
      ? {
          origins: "*",
          credentials: false,
          allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
          exposeHeaders: [
            "WWW-Authenticate",
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
      store: options.store ?? store,
      skip: (request) => {
        const { pathname } = new URL(request.url);
        return (
          (request.method === "GET" || request.method === "HEAD") &&
          (pathname === "/" || pathname === "/health")
        );
      },
      // Preserve the host's current proxy policy; never infer an identity from these headers.
      key: (request) =>
        (options.proxyPolicy === "vercel"
          ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
          : !options.insightProxy &&
            (request.headers.get("cf-connecting-ip") ??
              request.headers
                .get("x-vercel-forwarded-for")
                ?.split(",")[0]
                ?.trim())) ||
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown",
    },
    onError,
    toResponse: (value, event) => toResponse(value, event, event.app?.config),
    onSignal: (event, signal) => {
      event.context.httpSignal = signal;
    },
  });
}
