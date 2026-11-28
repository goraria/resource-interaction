import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/modules/structure/sso-directory", () => ({
  getServiceOrigin: async (key: string) => {
    const origins: Record<string, string> = {"video":"http://localhost:3031"};
    if (!origins[key]) throw new Error("Unregistered fixture service");
    return origins[key];
  },
  getApplicationOrigin: async (key: string) => {
    const origins: Record<string, string> = {"video":"http://localhost:3031"};
    if (!origins[key]) throw new Error("Unregistered fixture application");
    return origins[key];
  },
}));
vi.mock("@/utils/environment", () => ({
  oauthClientBindings: undefined,
  videoUrl: "http://localhost:3031",
  isProduction: false,
}));
import { assertVideoAccess } from "@/services/video-policy";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(Response.json({ allowed: true }));
});
afterEach(() => vi.unstubAllGlobals());
it("checks access at the managed Video endpoint with the delegated bearer", async () => {
  await assertVideoAccess(
    { resourceType: "video", resourceId: "id" },
    "Bearer delegated",
  );
  expect(String(fetchMock.mock.calls[0]![0])).toBe(
    "http://localhost:3031/catalog/access",
  );
  expect(fetchMock.mock.calls[0]![1]).toMatchObject({
    redirect: "error",
    cache: "no-store",
    headers: { Authorization: "Bearer delegated" },
  });
});
it.each([403, 404, 401])(
  "denies video interaction when source returns %s",
  async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    await expect(
      assertVideoAccess(
        { resourceType: "video", resourceId: "id" },
        "Bearer delegated",
      ),
    ).rejects.toMatchObject({ status: 403 });
  },
);
it("fails closed during a source outage", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  await expect(
    assertVideoAccess(
      { resourceType: "video", resourceId: "id" },
      "Bearer delegated",
    ),
  ).rejects.toMatchObject({ status: 503 });
});
it("rejects unknown resource types and missing credentials before fetching", async () => {
  await expect(
    assertVideoAccess(
      { resourceType: "user", resourceId: "id" },
      "Bearer delegated",
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    assertVideoAccess({ resourceType: "video", resourceId: "id" }, ""),
  ).rejects.toMatchObject({ status: 503 });
  expect(fetchMock).not.toHaveBeenCalled();
});
