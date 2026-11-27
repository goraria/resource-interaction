import { and, desc, eq, sql } from "drizzle-orm"

import { database } from "@/database"
import { reportsTable } from "@/database/schema"
import { ServiceError } from "@/lib/errors"
import type { CreateReportInput, ResolveReportInput } from "@/schemas/reports"
import type { AuthContext } from "@/utils/interface"

export async function rawListMyReports(auth: AuthContext, limit: number, offset: number) {
  return database
    .select()
    .from(reportsTable)
    .where(eq(reportsTable.reporterUserId, auth.user.id))
    .orderBy(desc(reportsTable.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function rawCreateReport(input: CreateReportInput, auth: AuthContext) {
  const [report] = await database
    .insert(reportsTable)
    .values({
      reporterUserId: auth.user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details,
      metadata: {
        ...(input.metadata ?? {}),
        application: auth.application,
      },
    })
    .returning()
  return report
}

export async function rawListReportsManagement(
  auth: AuthContext,
  status: "open" | "reviewing" | "resolved" | "dismissed" | undefined,
  limit: number,
  offset: number,
) {
  if (!new Set(["admin", "master"]).has(auth.user.role)) {
    throw new ServiceError("moderator_required", 403)
  }
  const applicationFilter = sql`${reportsTable.metadata}->>'application' = ${auth.application}`
  const where = status
    ? and(applicationFilter, eq(reportsTable.status, status))
    : applicationFilter
  return database
    .select()
    .from(reportsTable)
    .where(where)
    .orderBy(desc(reportsTable.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function rawResolveReportManagement(id: string, input: ResolveReportInput, auth: AuthContext) {
  if (!new Set(["admin", "master"]).has(auth.user.role)) {
    throw new ServiceError("moderator_required", 403)
  }
  const terminal = input.status === "resolved" || input.status === "dismissed"
  const [report] = await database
    .update(reportsTable)
    .set({
      status: input.status,
      resolution: input.resolution,
      resolvedByUserId: terminal ? auth.user.id : null,
      resolvedAt: terminal ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reportsTable.id, id),
        sql`${reportsTable.metadata}->>'application' = ${auth.application}`,
      ),
    )
    .returning()
  if (!report) throw new ServiceError("report_not_found", 404)
  return report
}
