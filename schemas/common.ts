import { z } from "zod"

export const uuidSchema = z.uuid()
export const metadataSchema = z.record(z.string(), z.unknown()).default({})

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export function getPagination(value: Record<string, string>) {
  return paginationSchema.parse(value)
}
