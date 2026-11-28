import { gunzipSync } from "node:zlib";
import { H3, HTTPError, onError } from "nitro/h3";
import { expect, it } from "vitest";
import { serviceHttp } from "@/middlewares/http";
import { quotaFixture } from "./http-quota-fixture";
import { getQueryValues } from "@/modules/principle/request";

function app(options: Parameters<typeof serviceHttp>[0] = { maxBodySize: 64 }) {
  return new H3({ silent: true }).use(serviceHttp({ ...options, store: options.store ?? quotaFixture() }));
}

it("preserves exact webhook bytes after enforcing body limits", async () => {
  const server = app();
  server.post(
    "/webhook",
    async (event) => new Response(await event.req.text()),
  );
  const body = '{ "value": "é", "amount": 1.00 }\r\n';
  const response = await server.request("/webhook", { method: "POST", body });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(body);
});

it("rejects oversized streamed and declared bodies before the handler runs", async () => {
  let calls = 0;
  const server = app();
  server.post("/webhook", () => {
    calls++;
    return "accepted";
  });
  for (const headers of [{}, { "content-length": "66" }]) {
    const response = await server.request("/webhook", {
      method: "POST",
      headers,
      body: "é".repeat(33),
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "payload_too_large" });
  }
  expect(calls).toBe(0);
});

it("retains single-value query semantics for signed callbacks", async () => {
  const server = app();
  server.get("/callback", (event) => Response.json(getQueryValues(event.req)));
  const response = await server.request(
    "/callback?vnp_Amount=100&vnp_Amount=200&name=A+B&name=C&__proto__=safe",
  );
  expect(await response.json()).toEqual(
    JSON.parse('{"vnp_Amount":"100","name":"A B","__proto__":"safe"}'),
  );
});

it("keeps health probes outside the rate counter and resets the counter by client", async () => {
  const server = app();
  server.get("/health", () => "healthy");
  server.get("/limited", () => "ok");
  for (let i = 0; i < 102; i++)
    expect((await server.request("/health")).status).toBe(200);
  for (let i = 0; i < 100; i++)
    expect((await server.request("/limited")).status).toBe(200);
  const response = await server.request("/limited");
  expect(response.status).toBe(429);
  expect(response.headers.get("ratelimit-remaining")).toBe("0");
  expect(response.headers.get("retry-after")).toBeTruthy();
  expect(
    (
      await server.request("/limited", {
        headers: { "x-real-ip": "127.0.0.2" },
      })
    ).status,
  ).toBe(200);
});

it("retains response status, protocol headers and the existing security policy", async () => {
  const server = app();
  server.get("/protected", () => {
    throw new HTTPError({
      status: 403,
      message: "forbidden",
      headers: { "WWW-Authenticate": "Bearer" },
    });
  });
  server.use(
    onError(
      (error) =>
        new Response(error.message, {
          status: error.status,
          headers: error.headers,
        }),
    ),
  );
  const response = await server.request("/protected", {
    headers: { "x-request-id": "test-123" },
  });
  expect(response.status).toBe(403);
  expect(await response.text()).toBe("forbidden");
  expect(response.headers.get("www-authenticate")).toBe("Bearer");
  expect(response.headers.get("x-request-id")).toBe("test-123");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("server-timing")).toMatch(/^total;dur=/);
});

it("compresses responses without changing the payload", async () => {
  const server = app({ maxBodySize: 64, compress: true });
  server.get("/large", () => Response.json({ text: "value".repeat(500) }));
  const response = await server.request("/large", {
    headers: { "accept-encoding": "gzip" },
  });
  expect(response.headers.get("content-encoding")).toBe("gzip");
  expect(
    JSON.parse(
      gunzipSync(Buffer.from(await response.arrayBuffer())).toString(),
    ),
  ).toEqual({ text: "value".repeat(500) });
  const plain = await server.request("/large", {
    headers: { "accept-encoding": "gzip;q=0, deflate;q=0" },
  });
  expect(plain.headers.get("content-encoding")).toBeNull();
});

it("handles configured CORS preflight before authentication", async () => {
  const server = app({ maxBodySize: 64, cors: true });
  let called = false;
  server.all("/**", () => {
    called = true;
    return new Response(null, { status: 401 });
  });
  const response = await server.request("/protected", {
    method: "OPTIONS",
    headers: {
      origin: "https://app.example",
      "access-control-request-method": "POST",
    },
  });
  expect(response.status).toBe(204);
  expect(response.headers.get("access-control-allow-origin")).toBe("*");
  expect(response.headers.get("access-control-allow-headers")).toContain(
    "Authorization",
  );
  expect(called).toBe(false);
});

it("keeps HEAD mapped to GET when the app provides its original JSON 404", async () => {
  const server = new H3({
    silent: true,
    onError: (error, event) => {
      if (error.status === 404)
        return Response.json({ error: "not_found" }, { status: 404 });
    },
  }).use(serviceHttp({ maxBodySize: 64, store: quotaFixture() }));
  server.get("/health", () => Response.json({ status: "ok" }));
  const response = await server.request("/health", { method: "HEAD" });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("");
  const missing = await server.request("/missing");
  expect(missing.status).toBe(404);
  expect(await missing.json()).toEqual({ error: "not_found" });
});

it("shares quota between middleware instances and fails closed on store errors", async () => {
  const store = quotaFixture();
  const a = app({ maxBodySize: 64, store }), b = app({ maxBodySize: 64, store });
  a.get("/shared", () => "ok"); b.get("/shared", () => "ok");
  const responses = await Promise.all(Array.from({ length: 101 }, (_, i) => (i % 2 ? a : b).request("/shared")));
  expect(responses.filter(r => r.status === 200)).toHaveLength(100);
  expect(responses.filter(r => r.status === 429)).toHaveLength(1);
  const unavailable = app({ maxBodySize: 64, store: { increment: async () => { throw new Error("private cause"); } } });
  let called = false;
  unavailable.get("/item", () => { called = true; return "unsafe"; });
  const failure = await unavailable.request("/item");
  expect(failure.status).toBe(503);
  expect(await failure.json()).toEqual({ error: "rate_limit_unavailable" });
  expect(called).toBe(false);
});
it("supplies a cancellation signal to cooperative host operations", async () => {
  const server = app();
  server.get("/signal", event => ({ aborted: (event.context.httpSignal as AbortSignal).aborted }));
  expect(await (await server.request("/signal")).json()).toEqual({ aborted: false });
});
