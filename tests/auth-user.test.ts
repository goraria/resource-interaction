import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  row: undefined as Record<string, unknown> | undefined,
  select: vi.fn(),
  insert: vi.fn(),
  upsert: vi.fn(),
  result: vi.fn(),
}));
vi.mock("@/utils/environment", () => ({ oauthClientBindings: undefined, authUrl: "https://sso.example" }));
vi.mock("@/database", () => ({
  database: {
    select: fixture.select,
    insert: fixture.insert,
  },
}));
import { rawGetServiceUser } from "@/models/users";
beforeEach(() => {
  vi.clearAllMocks();
  fixture.row = {
    id: "local-user",
    externalUserId: "sso-sub",
    email: "user@example.test",
    role: "user",
    status: "active",
    bannedAt: null,
    deletedAt: null,
    lastSeenAt: new Date(),
    banExpires: null,
  };
  fixture.select.mockImplementation(() => ({
    from: () => ({
      where: () => ({ limit: async () => (fixture.row ? [fixture.row] : []) }),
    }),
  }));
  fixture.result.mockImplementation(async () => [
    {
      ...fixture.row,
      id: "local-user",
      externalUserId: "sso-sub",
      role: "user",
      status: "active",
      lastSeenAt: new Date(),
    },
  ]);
  fixture.upsert.mockImplementation(() => ({ returning: fixture.result }));
  fixture.insert.mockImplementation(() => ({
    values: () => ({ onConflictDoUpdate: fixture.upsert }),
  }));
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({
      sub: "sso-sub",
      email: "user@example.test",
      name: "User",
      status: "active",
    }),
  );
});
it("warm local identity does not call UserInfo or write the user", async () => {
  const user = await rawGetServiceUser("sso-sub", "credential");
  expect(user.externalUserId).toBe("sso-sub");
  expect(globalThis.fetch).not.toHaveBeenCalled();
  expect(fixture.insert).not.toHaveBeenCalled();
});
it("provisions/refreshes by SSO sub and coalesces concurrent profile calls", async () => {
  fixture.row!.lastSeenAt = new Date(Date.now() - 601_000);
  await Promise.all([
    rawGetServiceUser("sso-sub", "credential"),
    rawGetServiceUser("sso-sub", "credential"),
  ]);
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  expect(fixture.insert).toHaveBeenCalledTimes(1);
  const [url, options] = vi.mocked(globalThis.fetch).mock.calls[0]!;
  expect(String(url)).toBe("https://sso.example/auth/oauth2/userinfo");
  expect(options?.redirect).toBe("error");
  expect(options?.signal).toBeInstanceOf(AbortSignal);
});
it("rejects profile subject mismatch or inactive identity before provisioning", async () => {
  fixture.row = undefined;
  vi.mocked(globalThis.fetch).mockResolvedValue(
    Response.json({
      sub: "other",
      email: "user@example.test",
      status: "active",
    }),
  );
  await expect(rawGetServiceUser("sso-sub", "credential")).rejects.toMatchObject({
    status: 401,
  });
  vi.mocked(globalThis.fetch).mockResolvedValue(
    Response.json({
      sub: "sso-sub",
      email: "user@example.test",
      status: "suspended",
    }),
  );
  await expect(rawGetServiceUser("sso-sub", "credential")).rejects.toMatchObject({
    status: 403,
  });
  expect(fixture.insert).not.toHaveBeenCalled();
});
it("handles a profile outage without falling back to a stale authorization decision", async () => {
  fixture.row!.lastSeenAt = new Date(0);
  vi.mocked(globalThis.fetch).mockResolvedValue(
    new Response(null, { status: 503 }),
  );
  await expect(rawGetServiceUser("sso-sub", "credential")).rejects.toMatchObject({
    status: 503,
  });
  expect(fixture.insert).not.toHaveBeenCalled();
});
