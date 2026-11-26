import { z } from "zod"

import { paginationSchema } from "@/schemas/common"

export const createReviewSchema = z.object({
  title: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(1).max(50_000),
  containsSpoiler: z.boolean().default(false),
})

export const updateReviewSchema = createReviewSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "empty_update" },
)

export const listReviewsSchema = paginationSchema

export type CreateReviewInput = z.infer<typeof createReviewSchema>
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>
