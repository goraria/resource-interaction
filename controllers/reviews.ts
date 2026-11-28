import type { Event } from "@/utils/interface";
import { getQueryValues, readRequestBody } from "@/modules/principle/request";
import { paginationSchema, uuidSchema } from "@/schemas/common";
import { createReviewSchema, updateReviewSchema } from "@/schemas/reviews";
import {
  rawCreateReview as createReviewServices,
  rawDeleteReview as deleteReviewServices,
  rawListReviews as listReviewsServices,
  rawUpdateReview as updateReviewServices,
} from "@/models/reviews";

export async function actListReviews(context: Event) {
  const { limit, offset } = paginationSchema.parse(getQueryValues(context.req.raw));
  return context.json(
    await listReviewsServices(
      uuidSchema.parse(context.req.param("id")!),
      limit,
      offset,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actCreateReview(context: Event) {
  const review = await createReviewServices(
    uuidSchema.parse(context.req.param("id")!),
    createReviewSchema.parse(await readRequestBody(context.req)),
    context.get("auth")!,
  );
  return context.json(review, {
    status: 201,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actUpdateReview(context: Event) {
  return context.json(
    await updateReviewServices(
      uuidSchema.parse(context.req.param("id")!),
      updateReviewSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actDeleteReview(context: Event) {
  await deleteReviewServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
