import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  rows: [] as unknown[][],
  network: vi.fn(),
  resource: {
    id: "local-resource",
    application: "social",
    resourceType: "post",
    resourceId: "external-post",
  },
}));
vi.mock("@/database", () => ({
  database: {
    select: () => {
      const q = {
        from: () => q,
        innerJoin: () => q,
        where: () => q,
        orderBy: () => q,
        limit: () => q,
        offset: () => q,
        then: (resolve: (rows: unknown[]) => unknown) =>
          Promise.resolve(f.rows.shift() ?? []).then(resolve),
      };
      return q;
    },
  },
}));
vi.mock("@/utils/sso-directory", () => ({
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
vi.mock("@/models/resources", async (original) => ({
  ...(await original<typeof import("@/models/resources")>()),
  rawRequireActiveResourceById: async () => f.resource,
}));
import { rawListComments, rawCreateComment } from "@/models/comments";
import { rawReactToComment } from "@/services/interactions";
import {
  rawCreateResource,
  rawUpdateResource,
  rawDeleteResource,
} from "@/models/resources";
import type { AuthContext } from "@/types/auth";
const auth = {
  application: "social",
  user: { id: "user", externalUserId: "viewer" },
} as AuthContext;
beforeEach(() => {
  vi.restoreAllMocks();
  f.rows = [];
  f.resource.application = "social";
  f.network = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      Response.json({ allowed: true, deniedSubjects: ["blocked"] }),
    );
});
it("removes blocked authors from a public post comment list while preserving pagination", async () => {
  f.rows = [
    [
      { id: "one", author: { id: "blocked" }, content: "private to blocker" },
      { id: "two", author: { id: "visible" }, content: "visible" },
    ],
    [{ total: 2 }],
  ];
  const result = await rawListComments(
    "local-resource",
    { limit: 20, offset: 0 },
    "Bearer caller",
  );
  expect(result.data.map((c) => c.id)).toEqual(["two"]);
  expect(result.pagination.hasMore).toBe(false);
});
it("refuses replies to a blocked author before starting a write transaction", async () => {
  f.rows = [
    [{ resourceType: "post", resourceId: "external-post", subject: "blocked" }],
  ];
  await expect(
    rawCreateComment(
      "local-resource",
      { content: "reply", parentId: "parent" },
      auth,
      "Bearer caller",
    ),
  ).rejects.toMatchObject({ status: 404 });
});
it("refuses reactions to a blocked comment author", async () => {
  f.rows = [
    [{ resourceType: "post", resourceId: "external-post", subject: "blocked" }],
  ];
  await expect(
    rawReactToComment("comment", { type: "like" }, auth, "Bearer caller"),
  ).rejects.toMatchObject({ status: 404 });
});
it("keeps non-Social comment queries independent of Social policy", async () => {
  f.resource.application = "task";
  f.rows = [[{ id: "one", author: { id: "blocked" } }], [{ total: 1 }]];
  expect(
    (await rawListComments("local-resource", { limit: 20, offset: 0 })).data,
  ).toHaveLength(1);
  expect(f.network).not.toHaveBeenCalled();
});
it.each(["create", "update", "delete"] as const)(
  "prevents a Social reader from claiming or %s-ing the shared interaction source",
  async (action) => {
    const result =
      action === "create"
        ? rawCreateResource({} as never, auth)
        : action === "update"
          ? rawUpdateResource("resource", {} as never, auth)
          : rawDeleteResource("resource", auth);
    await expect(result).rejects.toMatchObject({
      status: 403,
      message: "social_source_managed_by_app",
    });
  },
);
