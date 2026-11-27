import { Hono } from "hono"
import { beforeEach, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

import { ServiceError } from "@/lib/errors";
const fixture = vi.hoisted(() => ({
  rows: [] as unknown[][],
  filters: [] as unknown[][],
  inserted: vi.fn(),
  updated: vi.fn(),
  locked: vi.fn(),
  recentCount:0,
}));
vi.mock("@/database", () => {
  const db = {
    execute:async()=>({rows:[{n:fixture.recentCount}]}),
    select() {
      const query = {
        from: () => query,
        where(filter: SQL) {
          fixture.filters.push(new PgDialect().sqlToQuery(filter).params);
          return query;
        },
        limit: () => query,
        for: () => {
          fixture.locked();
          return query;
        },
        then(resolve: (value: unknown[]) => unknown) {
          return Promise.resolve(fixture.rows.shift() ?? []).then(resolve);
        },
      };
      return query;
    },
    insert: () => ({
      values(value: unknown) {
        fixture.inserted(value);
        return {
          returning: async () => [{ id: commentId, ...(value as object) }],
        };
      },
    }),
    update: () => ({
      set(value: unknown) {
        fixture.updated(value);
        return {
          where(filter: SQL) {
            fixture.filters.push(new PgDialect().sqlToQuery(filter).params);
            return { returning: async () => fixture.rows.shift() ?? [] };
          },
        };
      },
    }),
    transaction: async (callback: (tx: unknown) => unknown) => callback(db),
  };
  return { database: db };
});
import * as controller from "@/controllers/comments";
import type { Event } from "@/utils/interface";
const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const commentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const parentId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function app(application = "video") {
  const app = new Hono();
  app.use("*", async (c: Event, next) => {
    c.set("auth", {
      application,
      user: { id: "local-user", externalUserId: "subject" },
    } as never);
    return await next();
  });
  app.post("/resource/:id/comment", controller.actCreateComment);
  app.patch("/comment/:id", controller.actUpdateComment);
  app.delete("/comment/:id", controller.actDeleteComment);
  app.onError((error) => {
      return Response.json(
        { error: error.message },
        {
          status:
            error instanceof ZodError
              ? 400
              : error instanceof ServiceError
                ? error.status
                : 500,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    });
  return app;
}
function request(path: string, method: string, body?: unknown) {
  return app().request(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  fixture.rows = [];
  fixture.filters = [];
  fixture.recentCount=0;
});
it("runs validated create through controller, service and transaction with the authenticated author", async () => {
  fixture.rows = [[{ id: resourceId, status: "active", application: "video" }]];
  const response = await request(`/resource/${resourceId}/comment`, "POST", {
    content: " hello ",
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    authorUserId: "local-user",
    content: "hello",
    resourceId,
  });
  expect(fixture.inserted).toHaveBeenCalledOnce();
});
it('rate limits repeated Video comments inside the author transaction',async()=>{fixture.rows=[[{id:resourceId,status:'active',application:'video'}]];fixture.recentCount=30;expect((await request(`/resource/${resourceId}/comment`,'POST',{content:'Spam'})).status).toBe(429);expect(fixture.inserted).not.toHaveBeenCalled()});
it("rejects invalid comment input without writing", async () => {
  expect(
    (await request(`/resource/${resourceId}/comment`, "POST", { content: " " }))
      .status,
  ).toBe(400);
  expect(fixture.inserted).not.toHaveBeenCalled();
});
it.each([
  undefined,
  { id: parentId, resourceId: "other", status: "active" },
  { id: parentId, resourceId, status: "deleted" },
])(
  "rejects missing, cross-resource or deleted reply parents",
  async (parent) => {
    fixture.rows = [[{ id: resourceId }], parent ? [parent] : []];
    expect(
      (
        await request(`/resource/${resourceId}/comment`, "POST", {
          content: "reply",
          parentId,
        })
      ).status,
    ).toBe(404);
    expect(fixture.inserted).not.toHaveBeenCalled();
  },
);
it("locks an active parent and preserves the reply root", async () => {
  fixture.rows = [
    [{ id: resourceId }],
    [{ id: parentId, resourceId, rootId: commentId, status: "active" }],
  ];
  const response = await request(`/resource/${resourceId}/comment`, "POST", {
    content: "reply",
    parentId,
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ rootId: commentId, parentId });
  expect(fixture.locked).toHaveBeenCalledOnce();
});
it("restricts edits to the authenticated author and active comments", async () => {
  fixture.rows = [[]];
  expect(
    (await request(`/comment/${commentId}`, "PATCH", { content: "hijack" }))
      .status,
  ).toBe(404);
  expect(fixture.filters[0]).toEqual([commentId, "local-user", "active"]);
});
it("denies deletion by another author without changing counters", async () => {
  fixture.rows = [[{ id: commentId, authorUserId: "other", status: "active" }]];
  expect((await request(`/comment/${commentId}`, "DELETE")).status).toBe(404);
  expect(fixture.updated).not.toHaveBeenCalled();
});
it("repeated delete is idempotent and locks the selected row", async () => {
  fixture.rows = [
    [
      {
        id: commentId,
        authorUserId: "local-user",
        parentId,
        status: "deleted",
      },
    ],
  ];
  expect((await request(`/comment/${commentId}`, "DELETE")).status).toBe(204);
  expect(fixture.updated).not.toHaveBeenCalled();
  expect(fixture.locked).toHaveBeenCalledOnce();
});
it("does not decrement the Reader reply count again when an author deletes a hidden reply", async () => {
  fixture.rows = [
    [{ id: commentId, authorUserId: "local-user", parentId, status: "hidden" }],
    [{ id: commentId, status: "deleted" }],
  ];
  expect(
    (await app("reader").request("/comment/" + commentId, { method: "DELETE" }))
      .status,
  ).toBe(204);
  expect(fixture.updated).toHaveBeenCalledTimes(1);
});
