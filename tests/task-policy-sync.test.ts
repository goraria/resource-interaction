import { beforeEach, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { ServiceError } from "@/lib/errors";
import {
  decideTaskPolicySnapshot,
  assertTaskPolicyFresh,
} from "@/lib/task-policy-order";
import { taskPolicySnapshotSchema } from "@/schemas/task-policy-sync";
import type { TaskPolicySnapshot } from "@/schemas/task-policy-sync";

import type { TaskPolicyCheckpoint } from "@/utils/interface";
const fixture = vi.hoisted(() => ({
  receive: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@/lib/auth/machine", () => ({ verifyMachineRequest: fixture.verify }));
vi.mock("@/lib/auth/verification", () => ({
  serviceAuthFailure: () =>
    Response.json({ error: "forbidden" }, { status: 403 }),
}));
vi.mock("@/models/task-policy-projection", () => ({
  rawReceiveTaskPolicySnapshot: fixture.receive,
}));
import { filesystemRouter } from "./filesystem-router";
const time = 10000;
function event(
  overrides: Partial<TaskPolicySnapshot> = {},
): TaskPolicySnapshot {
  return {
    schemaVersion: 1,
    source: "task",
    type: "snapshot",
    epoch: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    revision: "1",
    snapshotId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    issuedAt: time,
    expiresAt: time + 120000,
    grants: [],
    ...overrides,
  };
}
const checkpoint = (): TaskPolicyCheckpoint => ({
  ...event(),
  revision: 1n,
  digest: "digest",
  issuedAt: new Date(time),
  expiresAt: new Date(time + 120000),
});
beforeEach(() => {
  vi.resetAllMocks();
  fixture.receive.mockResolvedValue({ accepted: true, applied: true });
});
it("applies initial and complete newer snapshots even when intermediate events were lost", () => {
  expect(decideTaskPolicySnapshot(undefined, event(), "digest", time)).toBe(
    "apply",
  );
  expect(
    decideTaskPolicySnapshot(
      checkpoint(),
      event({
        revision: "9",
        snapshotId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        issuedAt: time + 1,
      }),
      "new",
      time + 2,
    ),
  ).toBe("apply");
});
it("does not renew freshness for duplicate or out-of-order events", () => {
  expect(
    decideTaskPolicySnapshot(checkpoint(), event(), "digest", time + 1),
  ).toBe("ignore");
  expect(
    decideTaskPolicySnapshot(
      { ...checkpoint(), revision: 3n },
      event({ revision: "2" }),
      "older",
      time + 1,
    ),
  ).toBe("ignore");
});
it("accepts a newly captured complete heartbeat at the same revision", () => {
  expect(
    decideTaskPolicySnapshot(
      checkpoint(),
      event({
        snapshotId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        issuedAt: time + 10,
        expiresAt: time + 120010,
      }),
      "heartbeat",
      time + 10,
    ),
  ).toBe("apply");
});
it.each([
  { epoch: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" },
  { issuedAt: time + 6000 },
  { expiresAt: time },
  { expiresAt: time + 120001 },
])("rejects untrusted epoch/time: %j", (changes) => {
  expect(() =>
    decideTaskPolicySnapshot(checkpoint(), event(changes), "digest", time),
  ).toThrow(ServiceError);
});
it("rejects conflicting reuse of a snapshot ID", () => {
  expect(() =>
    decideTaskPolicySnapshot(checkpoint(), event(), "different", time),
  ).toThrow("policy_event_conflict");
});
it("refuses missing/expired projections but permits the last millisecond of the lease", () => {
  expect(() => assertTaskPolicyFresh(undefined, time)).toThrow(
    "task_policy_unavailable",
  );
  assertTaskPolicyFresh(checkpoint(), time + 119999);
  expect(() => assertTaskPolicyFresh(checkpoint(), time + 120000)).toThrow(
    "task_policy_unavailable",
  );
});
it("rejects incomplete envelopes, unknown grants, duplicate grants and arbitrary app sources", () => {
  const grant = { pageId: event().epoch, subject: "sub", comment: true };
  expect(
    taskPolicySnapshotSchema.safeParse({ ...event(), source: "reader" })
      .success,
  ).toBe(false);
  expect(
    taskPolicySnapshotSchema.safeParse({ ...event(), grants: [grant, grant] })
      .success,
  ).toBe(false);
  expect(
    taskPolicySnapshotSchema.safeParse({ ...event(), delta: [] }).success,
  ).toBe(false);
  expect(
    taskPolicySnapshotSchema.safeParse({ ...event(), revision: "0" }).success,
  ).toBe(false);
});
it("exposes an OAuth machine POST receiver without depending on app-session cookies or a Task callback", async () => {
  const app = filesystemRouter();
  app.onError((error) => {
      if (error instanceof ServiceError)
        return Response.json(
          { error: error.message },
          {
            status: error.status,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      if (error instanceof ZodError)
        return Response.json(
          { error: "invalid_event" },
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      return Response.json(
        { error: "failed" },
        {
          status: 500,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    });
  const body = JSON.stringify(event());
  const response = await app.request("/resource/policy/task/snapshot", {
    method: "POST",
    body,
    headers: { Authorization: "Bearer machine-access" },
  });
  expect(response.status).toBe(200);
  expect(fixture.receive).toHaveBeenCalledWith(
    event(),
    expect.stringMatching(/^[a-f0-9]{64}$/),
  );
  fixture.receive.mockClear();
  fixture.verify.mockRejectedValueOnce(new Error("ordinary user token"));
  expect(
    (
      await app.request("/resource/policy/task/snapshot", {
        method: "POST",
        body,
        headers: { Authorization: "Bearer normal-user-token" },
      })
    ).status,
  ).toBe(403);
  expect(fixture.receive).not.toHaveBeenCalled();
});
