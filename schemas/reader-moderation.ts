import { z } from "zod";
export const readerCommentModeration = z
  .object({ hidden: z.boolean(), reason: z.string().trim().min(5).max(2000) })
  .strict();
