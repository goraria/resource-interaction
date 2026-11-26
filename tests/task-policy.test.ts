import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { AuthContext } from "@/types/auth";
const fixture = vi.hoisted(() => ({
  database: vi.fn(),
  grants: vi.fn(),
  rows: [] as unknown[],
}));
vi.mock("@/database", () => ({ database: { select: fixture.database } }));
vi.mock("@/models/task-policy-projection", () => ({
  rawReadTaskPageGrants: fixture.grants,
}));
import {
  rawFindTaskRequestResource,
  rawFilterTaskResourceRecords,
  rawAssertTaskResourceAccess,
} from "@/services/task-policy";
const pageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reference = {
  application: "task",
  resourceType: "page",
  resourceId: pageId,
};
const auth = {
  application: "task",
  user: { externalUserId: "central-subject" },
} as AuthContext;
beforeEach(() => {
  vi.resetAllMocks();
  fixture.rows = [reference];
  const end = { limit: async () => fixture.rows };
  fixture.database.mockReturnValue({
    from: () => ({ innerJoin: () => ({ where: () => end }), where: () => end }),
  });
  fixture.grants.mockResolvedValue(new Set([pageId]));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("No Task callback permitted");
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
it.each(["commentId", "reviewId", "referenceId", "entityId"])(
  "resolves the actual Resource relation for %s",
  async (field) => {
    expect(
      await rawFindTaskRequestResource({ kind: "entity", [field]: pageId }),
    ).toEqual(reference);
    expect(fixture.database).toHaveBeenCalledTimes(1);
  },
);
it("checks the local projection with verified SSO sub, never a local app UUID or bearer callback", async () => {
  await rawAssertTaskResourceAccess(reference, auth, "comment");
  expect(fixture.grants).toHaveBeenCalledWith(
    "central-subject",
    [pageId],
    "comment",
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("denies missing grants, including revoked membership and archived/deleted pages", async () => {
  fixture.grants.mockResolvedValue(new Set());
  await expect(
    rawAssertTaskResourceAccess(reference, auth, "read"),
  ).rejects.toMatchObject({ status: 403 });
});
it("fails closed on missing, expired or unavailable projection", async () => {
  fixture.grants.mockRejectedValue(
    Object.assign(new Error("task_policy_unavailable"), { status: 503 }),
  );
  await expect(
    rawAssertTaskResourceAccess(reference, auth, "read"),
  ).rejects.toMatchObject({ status: 503 });
});
it("does not alter non-Task resources", async () => {
  await rawAssertTaskResourceAccess(
    { ...reference, application: "reader" },
    auth,
    "read",
  );
  expect(fixture.grants).not.toHaveBeenCalled();
});
it("rejects other-app identities before consulting Task grants", async () => {
  await expect(
    rawAssertTaskResourceAccess(
      reference,
      { ...auth, application: "reader" },
      "read",
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(fixture.grants).not.toHaveBeenCalled();
});
it("filters saves using one local lookup and retains non-Task items", async () => {
  const items = [
    { resource: reference },
    {
      resource: {
        ...reference,
        resourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    },
    { resource: { ...reference, application: "marketplace" } },
  ];
  expect(await rawFilterTaskResourceRecords(items, auth)).toEqual([
    items[0],
    items[2],
  ]);
  expect(fixture.grants).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});
it("never exposes Task saves to another application's token", async () => {
  expect(
    await rawFilterTaskResourceRecords([{ resource: reference }], {
      ...auth,
      application: "reader",
    }),
  ).toEqual([]);
  expect(fixture.grants).not.toHaveBeenCalled();
});
