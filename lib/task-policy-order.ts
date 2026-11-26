import { ServiceError } from "@/lib/errors";
import type { TaskPolicySnapshot } from "@/schemas/task-policy-sync";
import type { TaskPolicyCheckpoint } from "@/utils/interface";

export function decideTaskPolicySnapshot(
  current: TaskPolicyCheckpoint | undefined,
  event: TaskPolicySnapshot,
  digest: string,
  now = Date.now(),
) {
  if (
    event.issuedAt > now + 5000 ||
    event.expiresAt <= now ||
    event.expiresAt <= event.issuedAt ||
    event.expiresAt - event.issuedAt > 120_000
  )
    throw new ServiceError("untrusted_policy_time", 409);
  if (!current) return "apply";
  // A stream reset requires an operator-controlled rebootstrap.
  if (event.epoch !== current.epoch)
    throw new ServiceError("policy_epoch_mismatch", 409);
  const incoming = BigInt(event.revision);
  if (incoming < current.revision) return "ignore";
  if (event.snapshotId === current.snapshotId) {
    if (digest !== current.digest)
      throw new ServiceError("policy_event_conflict", 409);
    return "ignore"; // Idempotent delivery must not renew freshness.
  }
  if (
    incoming === current.revision &&
    event.issuedAt <= current.issuedAt.getTime()
  ) {
    if (
      event.issuedAt === current.issuedAt.getTime() &&
      digest !== current.digest
    )
      throw new ServiceError("policy_event_conflict", 409);
    return "ignore";
  }
  if (event.issuedAt < current.issuedAt.getTime())
    throw new ServiceError("policy_time_regressed", 409);
  // COMPLETE snapshots safely supersede any missed intermediate events.
  return "apply";
}

export function assertTaskPolicyFresh(
  checkpoint: { issuedAt: Date; expiresAt: Date } | undefined,
  now = Date.now(),
) {
  if (
    !checkpoint ||
    !Number.isFinite(checkpoint.issuedAt.getTime()) ||
    !Number.isFinite(checkpoint.expiresAt.getTime()) ||
    checkpoint.issuedAt.getTime() > now ||
    checkpoint.expiresAt.getTime() <= now ||
    checkpoint.expiresAt.getTime() - checkpoint.issuedAt.getTime() > 120_000
  )
    throw new ServiceError("task_policy_unavailable", 503);
}
