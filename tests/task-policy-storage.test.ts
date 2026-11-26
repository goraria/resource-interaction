import { beforeEach, expect, it, vi } from "vitest";
import type { TaskPolicySnapshot } from "@/schemas/task-policy-sync";
import { taskPolicyProjectionTable } from "@/database/task-policy";
const fixture = vi.hoisted(() => ({
  current: undefined as unknown,
  grants: [] as unknown[],
  fail: false,
  execute: vi.fn(),
}));
vi.mock("@/database", () => ({
  database: {
    transaction: async (
      operation: (transaction: unknown) => Promise<unknown>,
    ) => {
      let current = fixture.current;
      let grants = [...fixture.grants];
      const result = await operation({
        execute: fixture.execute,
        select: () => ({
          from: () => ({
            where: () => ({ limit: async () => (current ? [current] : []) }),
          }),
        }),
        delete: async () => {
          grants = [];
        },
        insert: (table: unknown) => ({
          values: (value: unknown) => {
            if (fixture.fail) throw new Error("Fixture storage failure");
            if (table === taskPolicyProjectionTable)
              return {
                onConflictDoUpdate: async () => {
                  current = value;
                },
              };
            grants.push(...(value as unknown[]));
            return Promise.resolve();
          },
        }),
      });
      fixture.current = current;
      fixture.grants = grants;
      return result;
    },
  },
}));
import { rawReceiveTaskPolicySnapshot } from "@/models/task-policy-projection";
const grant = {
  pageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  subject: "sub",
  comment: true,
};
function event(
  overrides: Partial<TaskPolicySnapshot> = {},
): TaskPolicySnapshot {
  const now = Date.now();
  return {
    schemaVersion: 1,
    source: "task",
    type: "snapshot",
    epoch: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    revision: "1",
    snapshotId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    issuedAt: now - 1000,
    expiresAt: now + 119_000,
    grants: [grant],
    ...overrides,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  fixture.current = undefined;
  fixture.grants = [];
  fixture.fail = false;
});
it("atomically replaces grants, including deletion snapshots and missed revision recovery", async () => {
  await rawReceiveTaskPolicySnapshot(event(), "one");
  expect(fixture.grants).toEqual([grant]);
  await rawReceiveTaskPolicySnapshot(
    event({
      revision: "10",
      snapshotId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      grants: [],
    }),
    "ten",
  );
  expect(fixture.grants).toEqual([]);
  expect(fixture.current).toMatchObject({ revision: 10n });
});
it("preserves the previous complete state if replacement fails midway", async () => {
  await rawReceiveTaskPolicySnapshot(event(), "one");
  const original = fixture.current;
  fixture.fail = true;
  await expect(
    rawReceiveTaskPolicySnapshot(
      event({
        revision: "2",
        snapshotId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      }),
      "two",
    ),
  ).rejects.toThrow();
  expect(fixture.current).toEqual(original);
  expect(fixture.grants).toEqual([grant]);
});
it("does not change checkpoints or grants when acknowledging a duplicate", async () => {
  const initial = event();
  await rawReceiveTaskPolicySnapshot(initial, "one");
  const original = fixture.current;
  expect(await rawReceiveTaskPolicySnapshot(initial, "one")).toEqual({
    accepted: true,
    applied: false,
  });
  expect(fixture.current).toBe(original);
  expect(fixture.grants).toEqual([grant]);
});
