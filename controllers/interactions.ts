import type { ApiContext } from "@/types/auth";
import { getQueryValues, readRequestBody } from "@/utils/request";
import { rawFilterTaskResourceRecords } from "@/services/task-policy";
import { paginationSchema, uuidSchema } from "@/schemas/common";
import {
  followSchema,
  ratingSchema,
  reactionSchema,
  saveSchema,
  saveTypeSchema,
  shareSchema,
  subscriptionSchema,
  voteSchema,
} from "@/schemas/interactions";
import {
  rawFollowResource as followResourceServices,
  rawGetRatingSummary as getRatingSummaryServices,
  rawGetResourceReactionSummary as getResourceReactionSummaryServices,
  rawGetMyResourceInteractionState as getMyResourceInteractionStateServices,
  rawListMyFollows as listMyFollowsServices,
  rawListMySaves as listMySavesServices,
  rawRateResource as rateResourceServices,
  rawReactToComment as reactToCommentServices,
  rawReactToResource as reactToResourceServices,
  rawReactToReview as reactToReviewServices,
  rawRemoveCommentReaction as removeCommentReactionServices,
  rawRemoveRating as removeRatingServices,
  rawRemoveResourceReaction as removeResourceReactionServices,
  rawRemoveReviewReaction as removeReviewReactionServices,
  rawSaveResource as saveResourceServices,
  rawShareResource as shareResourceServices,
  rawSubscribeResource as subscribeResourceServices,
  rawUnfollowResource as unfollowResourceServices,
  rawUnsaveResource as unsaveResourceServices,
  rawUnsubscribeResource as unsubscribeResourceServices,
  rawVoteOnResource as voteOnResourceServices,
} from "@/services/interactions";

export async function actListMyFollows(context: ApiContext) {
  const { limit, offset } = paginationSchema.parse(getQueryValues(context.req.raw));
  return context.json(
    await listMyFollowsServices(context.get("auth")!, limit, offset),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actFollowResource(context: ApiContext) {
  return context.json(
    await followResourceServices(
      uuidSchema.parse(context.req.param("id")!),
      followSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actUnfollowResource(context: ApiContext) {
  await unfollowResourceServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actSubscribeResource(context: ApiContext) {
  return context.json(
    await subscribeResourceServices(
      uuidSchema.parse(context.req.param("id")!),
      subscriptionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actUnsubscribeResource(context: ApiContext) {
  await unsubscribeResourceServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actGetMyResourceInteractionState(context: ApiContext) {
  return context.json(
    await getMyResourceInteractionStateServices(
      uuidSchema.parse(context.req.param("id")!),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actListMySaves(context: ApiContext) {
  const { limit, offset } = paginationSchema.parse(getQueryValues(context.req.raw));
  const rawType = getQueryValues(context.req.raw)["type"];
  const type = rawType ? saveTypeSchema.parse(rawType) : undefined;
  const resourceType = getQueryValues(context.req.raw)["resourceType"];
  if (resourceType && !/^[a-z0-9_-]{1,64}$/.test(resourceType))
    return context.json(
      { error: "invalid_resource_type" },
      {
        status: 400,
        headers: { "content-type": "application/json; charset=UTF-8" },
      },
    );
  const entries = await listMySavesServices(
    context.get("auth")!,
    type,
    limit,
    offset,
    resourceType,
  );
  return context.json(
    await rawFilterTaskResourceRecords(
      entries,
      context.get("auth")!,
      context.req.raw.headers.get("authorization") ?? undefined,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actSaveResource(context: ApiContext) {
  return context.json(
    await saveResourceServices(
      uuidSchema.parse(context.req.param("id")!),
      saveTypeSchema.parse(context.req.param("type")!),
      saveSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actUnsaveResource(context: ApiContext) {
  await unsaveResourceServices(
    uuidSchema.parse(context.req.param("id")!),
    saveTypeSchema.parse(context.req.param("type")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actGetResourceReactionSummary(context: ApiContext) {
  return context.json(
    await getResourceReactionSummaryServices(
      uuidSchema.parse(context.req.param("id")!),
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actReactToResource(context: ApiContext) {
  return context.json(
    await reactToResourceServices(
      uuidSchema.parse(context.req.param("id")!),
      reactionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveResourceReaction(context: ApiContext) {
  await removeResourceReactionServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actVoteOnResource(context: ApiContext) {
  return context.json(
    await voteOnResourceServices(
      uuidSchema.parse(context.req.param("id")!),
      voteSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actReactToComment(context: ApiContext) {
  return context.json(
    await reactToCommentServices(
      uuidSchema.parse(context.req.param("id")!),
      reactionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
      context.req.raw.headers.get("authorization") ?? "",
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveCommentReaction(context: ApiContext) {
  await removeCommentReactionServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actReactToReview(context: ApiContext) {
  return context.json(
    await reactToReviewServices(
      uuidSchema.parse(context.req.param("id")!),
      reactionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveReviewReaction(context: ApiContext) {
  await removeReviewReactionServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actGetRatingSummary(context: ApiContext) {
  return context.json(
    await getRatingSummaryServices(
      uuidSchema.parse(context.req.param("id")!),
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRateResource(context: ApiContext) {
  return context.json(
    await rateResourceServices(
      uuidSchema.parse(context.req.param("id")!),
      ratingSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveRating(context: ApiContext) {
  return context.json(
    await removeRatingServices(
      uuidSchema.parse(context.req.param("id")!),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actShareResource(context: ApiContext) {
  const share = await shareResourceServices(
    uuidSchema.parse(context.req.param("id")!),
    shareSchema.parse(await readRequestBody(context.req)),
    context.get("auth")!,
  );
  return context.json(share, {
    status: 201,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
