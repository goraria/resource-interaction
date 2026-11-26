import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/utils/environment", () => ({
  authUrl: "https://authority.fixture.test", isProduction: true,
}));
import { getApplicationOrigin, getServiceOrigin, getSsoDirectory } from "@/utils/sso-directory";

const directory = () => ({
  version: 1, environment: "production", issuer: "https://authority.fixture.test/auth",
  applications: { reader: { origin: "https://reader.fixture.test", clientIds: ["reader-id"] } },
  services: { payment: { origin: "https://payment.fixture.test", audience: "https://payment.fixture.test" } },
});
beforeEach(() => { vi.restoreAllMocks(); });
it("resolves only SSO registrations and deduplicates concurrent lookups", async () => {
  const remote = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(directory()));
  const [application, service] = await Promise.all([getApplicationOrigin("reader"), getServiceOrigin("payment")]);
  expect(application).toBe("https://reader.fixture.test");
  expect(service).toBe("https://payment.fixture.test");
  expect(remote).toHaveBeenCalledTimes(1);
  const [url, init] = remote.mock.calls[0]!;
  expect(String(url)).toBe("https://authority.fixture.test/.well-known/gorth-application?environment=production");
  expect(init).toMatchObject({ redirect: "error", cache: "no-store" });
});
it("does not turn unknown applications or services into fallback URLs", async () => {
  await expect(getServiceOrigin("unknown")).rejects.toMatchObject({ status: 503 });
  await expect(getApplicationOrigin("unknown")).rejects.toMatchObject({ status: 503 });
});
it("expires the cache and fails closed instead of retaining stale routing on authority failure", async () => {
  const now = Date.now();
  vi.spyOn(Date, "now").mockReturnValue(now + 31_000);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
  await expect(getSsoDirectory()).rejects.toMatchObject({ status: 503 });
});
it.each([
  { environment: "local" }, { issuer: "https://foreign.fixture.test/auth" },
  { services: { payment: { origin: "https://payment.fixture.test", audience: "https://foreign.fixture.test" } } },
  { applications: { reader: { origin: "http://127.0.0.1", clientIds: [] } } },
  { applications: { reader: { origin: "https://reader.fixture.test/private", clientIds: [] } } },
])("rejects environment/issuer/audience or destination mismatches: %j", async (override) => {
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31_000);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ ...directory(), ...override }));
  await expect(getSsoDirectory()).rejects.toMatchObject({ status: 503 });
});
