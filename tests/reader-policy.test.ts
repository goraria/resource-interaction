import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/utils/sso-directory", () => ({
  getServiceOrigin: async (key: string) => {
    const origins: Record<string, string> = {"reader":"https://reader.example.test"};
    if (!origins[key]) throw new Error("Unregistered fixture service");
    return origins[key];
  },
  getApplicationOrigin: async (key: string) => {
    const origins: Record<string, string> = {"reader":"https://reader.example.test"};
    if (!origins[key]) throw new Error("Unregistered fixture application");
    return origins[key];
  },
}));
vi.mock("@/utils/environment", () => ({
  oauthClientBindings: undefined,
  readerUrl: "https://reader.example.test",
  isProduction: true,
}));
import { assertReaderAccess } from "@/services/reader-policy";
const reference = { resourceType: "chapter", resourceId: crypto.randomUUID() };
beforeEach(() => vi.restoreAllMocks());
it("uses only the managed Reader origin with the delegated user identity", async () => {
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ allowed: true }));
  await assertReaderAccess(reference, "Bearer verified-user", "comment");
  expect(String(network.mock.calls[0]![0])).toBe(
    "https://reader.example.test/reader/access",
  );
  expect(network.mock.calls[0]![1]).toMatchObject({
    redirect: "error",
    cache: "no-store",
    headers: { Authorization: "Bearer verified-user" },
  });
  expect(JSON.parse(String(network.mock.calls[0]![1]?.body))).toEqual({
    ...reference,
    action: "comment",
  });
});
it.each([401, 403, 404, 500, 503])(
  "fails closed on Reader status %i",
  async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status }),
    );
    await expect(
      assertReaderAccess(reference, "Bearer user"),
    ).rejects.toMatchObject({ status: status >= 500 ? 503 : 403 });
  },
);
it("rejects ownership claims against another app, missing grants and unavailable policy", async () => {
  await expect(
    assertReaderAccess({ ...reference, resourceType: "page" }, "Bearer user"),
  ).rejects.toMatchObject({ status: 403 });
  await expect(assertReaderAccess(reference, "")).rejects.toMatchObject({
    status: 503,
  });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
  await expect(
    assertReaderAccess(reference, "Bearer user"),
  ).rejects.toMatchObject({ status: 503 });
});
