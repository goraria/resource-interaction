import type { ApiContext } from "@/types/auth";
import { createHash } from "node:crypto";
import { taskPolicySnapshotSchema } from "@/schemas/task-policy-sync";
import { rawReceiveTaskPolicySnapshot as receiveTaskPolicySnapshotServices } from "@/models/task-policy-projection";

import { ServiceError } from "@/lib/errors";
export async function actReceiveTaskPolicySnapshot(context: ApiContext) {
  const body = context.get("taskPolicyBody")!;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new ServiceError("invalid_policy_event", 400);
  }
  const event = taskPolicySnapshotSchema.parse(parsed);
  return context.json(
    await receiveTaskPolicySnapshotServices(
      event,
      createHash("sha256").update(body).digest("hex"),
    ),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
