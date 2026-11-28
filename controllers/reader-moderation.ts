import { readRequestBody } from "@/modules/principle/request";
import type { Event } from "@/utils/interface";
import { uuidSchema } from "@/schemas/common";
import { readerCommentModeration } from "@/schemas/reader-moderation";
import { rawModerateReaderCommentManagement as moderateReaderCommentServices } from "@/models/comments";
export async function actModerateReaderComment(c: Event) {
  return c.json(
    await moderateReaderCommentServices(
      uuidSchema.parse(c.req.param("id")),
      readerCommentModeration.parse(await readRequestBody(c.req)),
      c.get("auth")!,
    ),
  );
}
