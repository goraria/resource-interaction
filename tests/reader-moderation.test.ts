import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { reportsTable } from "@/database/schema";
const f = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }));
vi.mock("@/database", () => ({ database: { transaction: f.transaction } }));
import { rawModerateReaderCommentManagement } from "@/models/comments";
const auth = {
  application: "reader",
  user: { id: crypto.randomUUID(), role: "admin" },
};
beforeEach(() => {
  vi.resetAllMocks();
  f.transaction.mockImplementation((fn) => fn({ execute: f.execute }));
  f.execute.mockResolvedValue({ rows: [] });
});
it("denies normal users and other applications before touching any comment", async () => {
  for (const context of [
    { ...auth, user: { ...auth.user, role: "user" } },
    { ...auth, application: "task" },
  ])
    await expect(
      rawModerateReaderCommentManagement(
        "id",
        { hidden: true, reason: "Abuse review" },
        context as never,
      ),
    ).rejects.toMatchObject({ status: 403 });
  expect(f.transaction).not.toHaveBeenCalled();
});
it("does not mutate foreign or deleted content", async () => {
  for (const rows of [[], [{ id: "id", status: "deleted" }]]) {
    f.execute.mockResolvedValueOnce({ rows });
    await expect(
      rawModerateReaderCommentManagement(
        "id",
        { hidden: true, reason: "Abuse review" },
        auth as never,
      ),
    ).rejects.toMatchObject({ status: 404 });
  }
});
it("makes repeated hiding idempotent and avoids double decrementing reply counts", async () => {
  f.execute.mockResolvedValueOnce({
    rows: [{ id: "id", status: "hidden", parent_id: "parent" }],
  });
  expect(
    await rawModerateReaderCommentManagement(
      "id",
      { hidden: true, reason: "Abuse review" },
      auth as never,
    ),
  ).toEqual({ id: "id", status: "hidden" });
  expect(f.execute).toHaveBeenCalledTimes(2);
});
it("keeps the report target parameter compatible with the owned text column", async () => {
  const id = crypto.randomUUID();
  f.execute.mockResolvedValueOnce({
    rows: [{ id, status: "hidden", parent_id: null }],
  });
  await rawModerateReaderCommentManagement(
    id,
    { hidden: true, reason: "Reviewed content" },
    auth as never,
  );
  const query = new PgDialect().sqlToQuery(f.execute.mock.calls.at(-1)![0]);
  expect(reportsTable.targetId.getSQLType()).toBe("text");
  expect(query.sql).not.toMatch(/target_id=\$\d+::uuid/);
  expect(query.params).toContain(id);
});
