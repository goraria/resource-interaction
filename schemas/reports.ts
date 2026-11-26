import { z } from "zod"

import { metadataSchema, paginationSchema } from "@/schemas/common"

export const createReportSchema = z.object({
  targetType: z.string().trim().min(1).max(64),
  targetId: z.string().trim().min(1).max(512),
  reason: z.string().trim().min(1).max(128),
  details: z.string().trim().max(10_000).nullable().optional(),
  metadata: metadataSchema.optional(),
})

export const resolveReportSchema = z.object({
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolution: z.string().trim().max(10_000).nullable().optional(),
})

export const listReportsSchema = paginationSchema.extend({
  status: z.enum(["open", "reviewing", "resolved", "dismissed"]).optional(),
})

export type CreateReportInput = z.infer<typeof createReportSchema>
export type ResolveReportInput = z.infer<typeof resolveReportSchema>
