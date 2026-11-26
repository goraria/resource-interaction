import { z } from "zod"

import { metadataSchema, paginationSchema } from "@/schemas/common"

export const collectionVisibilitySchema = z.enum(["private", "unlisted", "public"])

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10_000).nullable().optional(),
  visibility: collectionVisibilitySchema.default("private"),
  metadata: metadataSchema.optional(),
})

export const updateCollectionSchema = createCollectionSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "empty_update" },
)

export const addCollectionResourceSchema = z.object({
  position: z.number().int().min(0).default(0),
})

export const listCollectionsSchema = paginationSchema

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>
export type AddCollectionResourceInput = z.infer<typeof addCollectionResourceSchema>
