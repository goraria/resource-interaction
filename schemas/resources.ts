import { z } from "zod"

import { metadataSchema, paginationSchema } from "@/schemas/common"

export const resourceStatusSchema = z.enum(["active", "hidden", "deleted"])

export const createResourceSchema = z.object({
  resourceType: z.string().trim().min(1).max(64),
  resourceId: z.string().trim().min(1).max(512),
  title: z.string().trim().max(500).nullable().optional(),
  canonicalUrl: z.url().max(2048).nullable().optional(),
  imageUrl: z.url().max(2048).nullable().optional(),
  metadata: metadataSchema.optional(),
})

export const updateResourceSchema = createResourceSchema
  .pick({ title: true, canonicalUrl: true, imageUrl: true, metadata: true })
  .extend({ status: resourceStatusSchema.optional() })

export const listResourcesSchema = paginationSchema.extend({
  application: z.string().trim().min(1).max(64).optional(),
  resourceType: z.string().trim().min(1).max(64).optional(),
  resourceId: z.string().trim().min(1).max(512).optional(),
  owner: z.string().trim().min(1).optional(),
  status: z.literal("active").default("active"),
})

export const resolveResourceSchema = z.object({
  application: z.string().trim().min(1).max(64),
  resourceType: z.string().trim().min(1).max(64),
  resourceId: z.string().trim().min(1).max(512),
})

export const counterMutationSchema = z
  .object({
    value: z.number().int().min(0).optional(),
    delta: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  })
  .refine((value) => value.value !== undefined || value.delta !== undefined, {
    message: "value_or_delta_required",
  })

export const verifiedReferenceSchema = z.object({
  sourceType: z.string().trim().min(1).max(64),
  sourceId: z.string().trim().min(1).max(512),
  metadata: metadataSchema.optional(),
})

export type CreateResourceInput = z.infer<typeof createResourceSchema>
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>
export type ListResourcesInput = z.infer<typeof listResourcesSchema>
export type ResolveResourceInput = z.infer<typeof resolveResourceSchema>
export type CounterMutationInput = z.infer<typeof counterMutationSchema>
export type VerifiedReferenceInput = z.infer<typeof verifiedReferenceSchema>
