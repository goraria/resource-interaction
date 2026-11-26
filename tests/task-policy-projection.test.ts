import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ select: vi.fn(), rows: [] as unknown[] }));
vi.mock("@/database", () => ({ database: { select: fixture.select } }));
import { rawReadTaskPageGrants } from "@/models/task-policy-projection";
const page = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => {
  vi.resetAllMocks();
  const now = Date.now();
  fixture.rows = [
    {
      issuedAt: new Date(now - 1000),
      expiresAt: new Date(now + 119_000),
      pageId: page,
      comment: false,
    },
  ];
  fixture.select.mockReturnValue({
    from: () => ({ leftJoin: () => ({ where: async () => fixture.rows }) }),
  });
});
it("distinguishes read from comment on the same projected page", async () => {
  expect(await rawReadTaskPageGrants("sub", [page], "read")).toEqual(
    new Set([page]),
  );
  expect(await rawReadTaskPageGrants("sub", [page], "comment")).toEqual(new Set());
});
it("denies expired or absent checkpoint even if a stale grant exists", async () => {
  fixture.rows = [
    {
      issuedAt: new Date(0),
      expiresAt: new Date(120_000),
      pageId: page,
      comment: true,
    },
  ];
  await expect(rawReadTaskPageGrants("sub", [page], "read")).rejects.toMatchObject(
    { status: 503 },
  );
  fixture.rows = [];
  await expect(rawReadTaskPageGrants("sub", [page], "read")).rejects.toMatchObject(
    { status: 503 },
  );
});
it("returns no grant for a deleted/archived page or removed member", async () => {
  const now = Date.now();
  fixture.rows = [
    {
      issuedAt: new Date(now),
      expiresAt: new Date(now + 120_000),
      pageId: null,
      comment: null,
    },
  ];
  expect(await rawReadTaskPageGrants("sub", [page], "read")).toEqual(new Set());
});
it("fails closed for projection DB failures and skips empty batch lookups", async () => {
  fixture.select.mockImplementation(() => {
    throw new Error("Database unavailable");
  });
  await expect(rawReadTaskPageGrants("sub", [page], "read")).rejects.toMatchObject(
    { status: 503 },
  );
  fixture.select.mockClear();
  expect(await rawReadTaskPageGrants("sub", [], "read")).toEqual(new Set());
  expect(fixture.select).not.toHaveBeenCalled();
});
