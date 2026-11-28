import type { Event } from "@/utils/interface";
import { getQueryValues, readRequestBody } from "@/modules/principle/request";
import {
  createCommentSchema,
  listCommentsSchema,
  updateCommentSchema,
} from "@/schemas/comments";
import { uuidSchema } from "@/schemas/common";
import {
  rawCreateComment as createCommentServices,
  rawDeleteComment as deleteCommentServices,
  rawListComments as listCommentsServices,
  rawUpdateComment as updateCommentServices,
} from "@/models/comments";

export async function actListComments(context: Event) {
  return context.json(
    await listCommentsServices(
      uuidSchema.parse(context.req.param("id")!),
      listCommentsSchema.parse(getQueryValues(context.req.raw)),
      context.req.raw.headers.get("authorization") ?? "",
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actCreateComment(context: Event) {
  const comment = await createCommentServices(
    uuidSchema.parse(context.req.param("id")!),
    createCommentSchema.parse(await readRequestBody(context.req)),
    context.get("auth")!,
    context.req.raw.headers.get("authorization") ?? "",
  );
  return context.json(comment, {
    status: 201,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actUpdateComment(context: Event) {
  return context.json(
    await updateCommentServices(
      uuidSchema.parse(context.req.param("id")!),
      updateCommentSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actDeleteComment(context: Event) {
  await deleteCommentServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
