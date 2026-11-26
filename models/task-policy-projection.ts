import { and, eq, inArray, sql } from "drizzle-orm"
import { database } from "@/database"
import { taskPolicyGrantTable, taskPolicyProjectionTable } from "@/database/task-policy"
import { assertTaskPolicyFresh, decideTaskPolicySnapshot } from "@/lib/task-policy-order"
import { ServiceError } from "@/lib/errors"
import { type TaskResourceAccess } from "@/utils/interface"
import { type TaskPolicySnapshot } from "@/schemas/task-policy-sync"

// One statement observes a coherent committed checkpoint + grants.
export async function rawReadTaskPageGrants(
  subject: string,
  ids: string[],
  access: TaskResourceAccess,
) {
  if (!ids.length) return new Set<string>();
  try {
    const rows = await database
      .select({
        issuedAt: taskPolicyProjectionTable.issuedAt,
        expiresAt: taskPolicyProjectionTable.expiresAt,
        pageId: taskPolicyGrantTable.pageId,
        comment: taskPolicyGrantTable.comment,
      })
      .from(taskPolicyProjectionTable)
      .leftJoin(
        taskPolicyGrantTable,
        and(
          eq(taskPolicyGrantTable.subject, subject),
          inArray(taskPolicyGrantTable.pageId, ids),
        ),
      )
      .where(eq(taskPolicyProjectionTable.id, "task"));
    assertTaskPolicyFresh(rows[0]);
    return new Set(
      rows
        .filter(
          (row) => row.pageId && (access === "read" || row.comment === true),
        )
        .map((row) => row.pageId!),
    );
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("task_policy_unavailable", 503);
  }
}

export async function rawReceiveTaskPolicySnapshot(
  event: TaskPolicySnapshot,
  digest: string,
) {
  return await database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(734901)`);
    const [current] = await transaction
      .select()
      .from(taskPolicyProjectionTable)
      .where(eq(taskPolicyProjectionTable.id, "task"))
      .limit(1);
    const action = decideTaskPolicySnapshot(current, event, digest);
    if (action === "ignore") return { accepted: true, applied: false };
    // Atomic replacement prevents partial grants or missing deletes.
    await transaction.delete(taskPolicyGrantTable);
    for (let offset = 0; offset < event.grants.length; offset += 1000)
      await transaction
        .insert(taskPolicyGrantTable)
        .values(event.grants.slice(offset, offset + 1000));
    const values = {
      id: "task",
      epoch: event.epoch,
      revision: BigInt(event.revision),
      snapshotId: event.snapshotId,
      digest,
      issuedAt: new Date(event.issuedAt),
      expiresAt: new Date(event.expiresAt),
    };
    decideTaskPolicySnapshot(current, event, digest);
    await transaction
      .insert(taskPolicyProjectionTable)
      .values(values)
      .onConflictDoUpdate({
        target: taskPolicyProjectionTable.id,
        set: values,
      });
    return { accepted: true, applied: true };
  });
}
