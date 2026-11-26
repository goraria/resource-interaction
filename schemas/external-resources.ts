import { z } from "zod"

import { createReportSchema } from "@/schemas/reports"
import { saveTypeSchema } from "@/schemas/interactions"

export const externalResourceKeySchema = z.object({
  resourceType: z.string().trim().min(1).max(64),
  resourceId: z.string().trim().min(1).max(512),
})

export const externalResourceQuerySchema = z.object({
  id: z.string().trim().min(1).max(512),
})

export const externalCommentQuerySchema = externalResourceQuerySchema.extend({
  comment: z.string().uuid().optional(),
})

export const externalReviewQuerySchema = externalResourceQuerySchema.extend({
  review: z.string().uuid().optional(),
})

export const externalBookmarkQuerySchema = externalResourceQuerySchema.extend({
  list: saveTypeSchema.default("bookmark"),
})

export const externalReportSchema = createReportSchema.pick({
  reason: true,
  details: true,
})

export type ExternalResourceKey = z.infer<typeof externalResourceKeySchema>
