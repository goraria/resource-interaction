// Run with Node after "bun run build": exercises the actual Vercel bundle, not source mocks.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// Fixtures override ambient deployment values before dotenv's normal automatic loading.
// A local quota fixture keeps this check independent of Postgres and external services.
Object.assign(process.env, {
  NODE_ENV: "production",
  VERCEL: "",
  NITRO_PUBLIC_AUTH_URL: "https://sso.fixture.test",
  DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
  CRON_SECRET: "artifact-smoke-fixture",
  NITRO_OAUTH_CLIENT_BINDINGS: '{"replacement-fixture":"reader"}',
});
let upstreamRequests = 0;
globalThis.fetch = async () => {
  upstreamRequests++;
  throw new Error("Unexpected upstream request during unauthenticated artifact check");
};
let quotaQueries = 0;
globalThis.resourceInteractionPool = {
  async query(sql, [, now, windowMs]) {
    quotaQueries++;
    assert.match(sql, /INSERT INTO http_rate_limit/);
    return { rows: [{ hits: 1, reset_at: now + windowMs }] };
  },
};
const nativeResponse = globalThis.Response;
const { default: handler } = await import("../.vercel/output/functions/__server.func/index.mjs");
assert.equal(globalThis.Response, nativeResponse, "retain standard Response semantics");
const root = new URL("../.vercel/output/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const config = read("functions/__server.func/.vc-config.json");
assert.equal(config.runtime, "nodejs24.x");
const expectedTopic = null;
const queuePath = "functions/_vercel/queues/consumer.func/.vc-config.json";
assert.equal(existsSync(new URL(queuePath, root)), Boolean(expectedTopic));
if (expectedTopic) {
  const triggers = read(queuePath).experimentalTriggers;
  assert.ok(triggers.some((trigger) =>
    trigger.type === "queue/v2beta" && trigger.topic === expectedTopic &&
    trigger.retryAfterSeconds === 60));
  assert.equal(config.maxDuration, 300);
}
assert.deepEqual(
  (read("config.json").crons ?? []).map((cron) => cron.schedule).sort(),
  [].sort(),
);
const checks = [
  ["/health", "GET", 200],
  ["/health", "HEAD", 200],
  ["/health/", "GET", 404],
  ["/health/", "HEAD", 404],
  ["/resource/user/me", "GET", 401],
  ["/artifact-missing-route", "GET", 404],
];
if (expectedTopic) checks.push(["/_vercel/cron", "GET", 401]);
for (const [path, method, expected] of checks) {
  const upstreamBefore = upstreamRequests;
  const quotaBefore = quotaQueries;
  const response = await handler.fetch(new Request("https://service.fixture.test" + path, { method }));
  assert.equal(response.status, expected, method + " " + path);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  if (path === "/health") {
    assert.equal(upstreamRequests, upstreamBefore, "health must not call SSO or another upstream");
    assert.equal(quotaQueries, quotaBefore, "health must not read the quota store");
    if (method === "HEAD") assert.equal(await response.text(), "");
    else assert.match((await response.json()).status, /^ok$/i);
  } else {
    await response.arrayBuffer();
  }
}
console.log(JSON.stringify({ runtime: config.runtime, topic: expectedTopic, checks: checks.length }));
process.exit(0);
