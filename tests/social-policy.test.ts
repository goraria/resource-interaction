import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/modules/structure/sso-directory", () => ({
  getServiceOrigin: async (key: string) => {
    const origins: Record<string, string> = {"social":"https://social.example.test"};
    if (!origins[key]) throw new Error("Unregistered fixture service");
    return origins[key];
  },
  getApplicationOrigin: async (key: string) => {
    const origins: Record<string, string> = {"social":"https://social.example.test"};
    if (!origins[key]) throw new Error("Unregistered fixture application");
    return origins[key];
  },
}));
vi.mock("@/utils/environment", () => ({
  oauthClientBindings: undefined,
  socialUrl: "https://social.example.test",
  isProduction: true,
}));
import { assertSocialAccess } from "@/services/social-policy";
beforeEach(() => {
  vi.restoreAllMocks();
});
const reference = {
  resourceType: "post",
  resourceId: "b57aa0f8-44c5-4de1-9f18-c109647891a5",
};
it("uses only the managed Social origin and forwards the verified caller identity", async () => {
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(Response.json({ allowed: true }));
  await assertSocialAccess(reference, "Bearer user-token", "comment");
  const [url, options] = network.mock.calls[0]!;
  expect(String(url)).toBe("https://social.example.test/social/access");
  expect(options?.headers).toMatchObject({
    Authorization: "Bearer user-token",
  });
  expect(JSON.parse(String(options?.body))).toEqual({
    ...reference,
    action: "comment",
  });
  expect(options?.redirect).toBe("error");
});
it.each([401, 403, 404, 500, 503])(
  "fails closed when Social returns %s",
  async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status }),
    );
    await expect(
      assertSocialAccess(reference, "Bearer caller"),
    ).rejects.toMatchObject({ status: status >= 500 ? 503 : 403 });
  },
);
it("rejects missing grants, unsupported types, timeouts and invalid policy responses", async () => {
  await expect(assertSocialAccess(reference, "")).rejects.toMatchObject({
    status: 503,
  });
  await expect(
    assertSocialAccess({ ...reference, resourceType: "page" }, "Bearer caller"),
  ).rejects.toMatchObject({ status: 403 });
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("offline"));
  await expect(
    assertSocialAccess(reference, "Bearer caller"),
  ).rejects.toMatchObject({ status: 503 });
  network.mockResolvedValue(Response.json({ allowed: false }));
  await expect(
    assertSocialAccess(reference, "Bearer caller"),
  ).rejects.toMatchObject({ status: 403 });
});
it("requires a valid subject decision when filtering comments", async () => {
  const network = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      Response.json({ allowed: true, deniedSubjects: ["blocked"] }),
    );
  expect(
    await assertSocialAccess(reference, "Bearer caller", "read", [
      "blocked",
      "visible",
    ]),
  ).toEqual({ deniedSubjects: ["blocked"] });
  expect(JSON.parse(String(network.mock.calls[0]![1]?.body)).subjects).toEqual([
    "blocked",
    "visible",
  ]);
  network.mockResolvedValue(Response.json({ allowed: true }));
  await expect(
    assertSocialAccess(reference, "Bearer caller", "read", ["blocked"]),
  ).rejects.toMatchObject({ status: 503 });
});
