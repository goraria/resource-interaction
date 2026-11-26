import { z } from "zod"

import { paginationSchema, uuidSchema } from "@/schemas/common"

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(10_000),
  parentId: uuidSchema.nullable().optional(),
})

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1).max(10_000),
})

export const listCommentsSchema = paginationSchema.extend({
  parentId: uuidSchema.nullable().optional(),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
export type ListCommentsInput = z.infer<typeof listCommentsSchema>
