import { z } from "zod";
import { listCommentsSchema } from "@/schemas/comments";
export const videoReadSchema = z.object({ videoId: z.uuid() }).strict();
export const videoCommentsSchema = videoReadSchema
  .extend({
    limit: listCommentsSchema.shape.limit,
    offset: listCommentsSchema.shape.offset,
    parentId: listCommentsSchema.shape.parentId,
  })
  .strict();
