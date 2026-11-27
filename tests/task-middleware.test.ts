import { Hono } from "hono"
import type { Event, Binding, TaskResourceLookupKind } from "@/utils/interface";
import type { MiddlewareHandler } from "hono"
import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  find: vi.fn(),
  check: vi.fn(),
  require: vi.fn<(access?: string) => MiddlewareHandler<Binding>>(),
}));
vi.mock("@/services/task-policy", () => ({
  rawFindTaskRequestResource: fixture.find,
  rawAssertTaskResourceAccess: fixture.check,
}));
vi.mock("@/middlewares/auth", () => ({ requireAuth: fixture.require }));
import { protectTaskResource } from "@/middlewares/task-resource";

const pageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reference = {
  application: "task",
  resourceType: "page",
  resourceId: pageId,
};
function app(kind: TaskResourceLookupKind, application?: string) {
  const router = new Hono();
  if (application)
    router.use("*", async (c: Event, next) => {
      c.set("auth", {
        application,
        user: { externalUserId: "central-subject" },
      } as never);
      return await next();
    });
  router.get(
    "/entity/:id",
    protectTaskResource(kind),
    (c) =>
      Response.json(
        { data: "protected" },
        { headers: { "content-type": "application/json; charset=UTF-8" } },
      ),
  );
  router.post(
    "/page",
    protectTaskResource("resource", "comment"),
    (c) =>
      Response.json(
        { created: true },
        { headers: { "content-type": "application/json; charset=UTF-8" } },
      ),
  );
  router.get(
    "/comment/page",
    protectTaskResource("external", "comment"),
    (c) =>
      Response.json(
        { deleted: true },
        { headers: { "content-type": "application/json; charset=UTF-8" } },
      ),
  );
  router.onError((error) => {
      return Response.json(
        { error: (error as Error).message },
        {
          status:
            ((
              error as {
                status?: number;
              }
            ).status as 403) ?? 500,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    });
  return router;
}
beforeEach(() => {
  vi.resetAllMocks();
  fixture.find.mockResolvedValue(reference);
  fixture.check.mockResolvedValue(undefined);
  fixture.require.mockImplementation(() => async (c, next) => {
    if (!c.req.header("authorization"))
      return Response.json(
        { error: "unauthorized" },
        {
          status: 401,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    c.set("auth", {
      application: "task",
      user: { externalUserId: "central-subject" },
    } as never);
    return await next();
  });
});
it("requires authentication on otherwise public Task comment reads", async () => {
  expect((await app("entity").request("/entity/" + pageId)).status).toBe(401);
  expect(fixture.check).not.toHaveBeenCalled();
});
it("rejects a valid token belonging to a different application", async () => {
  expect(
    (
      await app("entity", "reader").request("/entity/" + pageId, {
        headers: { Authorization: "Bearer token" },
      })
    ).status,
  ).toBe(403);
  expect(fixture.check).not.toHaveBeenCalled();
});
it.each(["entity", "comment", "review", "reference"] as const)(
  "checks Task access through the %s lookup",
  async (kind) => {
    const response = await app(kind, "task").request("/entity/" + pageId, {
      headers: { Authorization: "Bearer token" },
    });
    expect(response.status).toBe(200);
    expect(fixture.check).toHaveBeenCalledWith(
      reference,
      expect.objectContaining({
        application: "task",
        user: { externalUserId: "central-subject" },
      }),
      "read",
    );
  },
);
it("checks a new Task resource before the first Resource row is created", async () => {
  fixture.find.mockResolvedValue(null);
  const response = await app("entity", "task").request("/page", {
    method: "POST",
    headers: {
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resourceType: "page", resourceId: pageId }),
  });
  expect(response.status).toBe(200);
  expect(fixture.check).toHaveBeenCalledWith(
    reference,
    expect.objectContaining({
      application: "task",
      user: { externalUserId: "central-subject" },
    }),
    "comment",
  );
});
it("uses the actual comment relation and rejects an unrelated page parameter", async () => {
  const response = await app("entity", "task").request(
    "/comment/page?id=another-page&comment=" + pageId,
    { headers: { Authorization: "Bearer token" } },
  );
  expect(response.status).toBe(403);
  expect(fixture.check).not.toHaveBeenCalled();
});
it("passes public non-Task resources through unchanged", async () => {
  fixture.find.mockResolvedValue({ ...reference, application: "marketplace" });
  expect((await app("entity").request("/entity/" + pageId)).status).toBe(200);
  expect(fixture.require).not.toHaveBeenCalled();
});
it("does not bypass a denied workspace projection", async () => {
  fixture.check.mockRejectedValue(
    Object.assign(new Error("workspace_forbidden"), { status: 403 }),
  );
  expect(
    (
      await app("entity", "task").request("/entity/" + pageId, {
        headers: { Authorization: "Bearer token" },
      })
    ).status,
  ).toBe(403);
});
