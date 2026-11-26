import type { ApiContext } from "@/types/auth";
import { getQueryValues, readRequestBody } from "@/utils/request";
import {
  createCommentSchema,
  listCommentsSchema,
  updateCommentSchema,
} from "@/schemas/comments";
import { uuidSchema } from "@/schemas/common";
import {
  externalBookmarkQuerySchema,
  externalCommentQuerySchema,
  externalReportSchema,
  externalResourceKeySchema,
  externalResourceQuerySchema,
  externalReviewQuerySchema,
} from "@/schemas/external-resources";
import {
  followSchema,
  ratingSchema,
  reactionSchema,
  saveSchema,
  shareSchema,
  subscriptionSchema,
  voteSchema,
} from "@/schemas/interactions";
import {
  rawCreateComment as createCommentServices,
  rawDeleteComment as deleteCommentServices,
  rawListComments as listCommentsServices,
  rawUpdateComment as updateCommentServices,
} from "@/models/comments";
import {
  rawEnsureExternalResource,
  rawFindExternalResource,
  rawGetExternalResourceSummary as getExternalResourceSummaryServices,
} from "@/models/resources";
import {
  rawFollowResource as followResourceServices,
  rawGetMyResourceInteractionState as getMyResourceInteractionStateServices,
  rawRateResource as rateResourceServices,
  rawReactToComment as reactToCommentServices,
  rawReactToResource as reactToResourceServices,
  rawRemoveCommentReaction as removeCommentReactionServices,
  rawRemoveRating as removeRatingServices,
  rawRemoveResourceReaction as removeResourceReactionServices,
  rawReactToReview as reactToReviewServices,
  rawRemoveReviewReaction as removeReviewReactionServices,
  rawSaveResource as saveResourceServices,
  rawShareResource as shareResourceServices,
  rawSubscribeResource as subscribeResourceServices,
  rawUnfollowResource as unfollowResourceServices,
  rawUnsaveResource as unsaveResourceServices,
  rawUnsubscribeResource as unsubscribeResourceServices,
  rawVoteOnResource as voteOnResourceServices,
} from "@/services/interactions";
import { rawCreateReport as createReportServices } from "@/models/reports";
import { createReviewSchema, updateReviewSchema } from "@/schemas/reviews";
import {
  rawCreateReview as createReviewServices,
  rawDeleteReview as deleteReviewServices,
  rawListReviews as listReviewsServices,
  rawUpdateReview as updateReviewServices,
} from "@/models/reviews";

function getKey(context: ApiContext) {
  const { id } = externalResourceQuerySchema.parse(getQueryValues(context.req.raw));
  return {
    ...externalResourceKeySchema.parse({
      resourceType: context.req.param("resourceType")!,
      resourceId: id,
    }),
    application:
      context.get("auth")?.application ?? getQueryValues(context.req.raw).application,
  };
}
function getCommentId(context: ApiContext) {
  const { comment } = externalCommentQuerySchema.parse(getQueryValues(context.req.raw));
  return uuidSchema.parse(comment);
}
function getReviewId(context: ApiContext) {
  const { review } = externalReviewQuerySchema.parse(getQueryValues(context.req.raw));
  return uuidSchema.parse(review);
}
async function getProtectedResource(context: ApiContext) {
  return rawEnsureExternalResource(getKey(context), context.get("auth")!);
}
export async function actGetExternalResourceSummary(context: ApiContext) {
  return context.json(
    await getExternalResourceSummaryServices(getKey(context)),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actListExternalComments(context: ApiContext) {
  const input = listCommentsSchema.parse(getQueryValues(context.req.raw));
  const resource = await rawFindExternalResource(getKey(context));
  if (!resource) {
    return context.json(
      {
        data: [],
        pagination: {
          limit: input.limit,
          offset: input.offset,
          total: 0,
          hasMore: false,
        },
      },
      { headers: { "content-type": "application/json; charset=UTF-8" } },
    );
  }
  return context.json(
    await listCommentsServices(
      resource.id,
      input,
      context.req.raw.headers.get("authorization") ?? "",
    ),
    {
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
export async function actGetMyExternalResourceState(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await getMyResourceInteractionStateServices(
      resource.id,
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actCreateExternalComment(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await createCommentServices(
      resource.id,
      createCommentSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
      context.req.raw.headers.get("authorization") ?? "",
    ),
    {
      status: 201,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
export async function actUpdateExternalComment(context: ApiContext) {
  return context.json(
    await updateCommentServices(
      getCommentId(context),
      updateCommentSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actDeleteExternalComment(context: ApiContext) {
  await deleteCommentServices(getCommentId(context), context.get("auth")!);
  return new Response(null, { status: 204 });
}
export async function actReactToExternalComment(context: ApiContext) {
  return context.json(
    await reactToCommentServices(
      uuidSchema.parse(
        externalResourceQuerySchema.parse(getQueryValues(context.req.raw)).id,
      ),
      reactionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
      context.req.raw.headers.get("authorization") ?? "",
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveExternalCommentReaction(context: ApiContext) {
  await removeCommentReactionServices(
    uuidSchema.parse(
      externalResourceQuerySchema.parse(getQueryValues(context.req.raw)).id,
    ),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actListExternalReviews(context: ApiContext) {
  const input = listCommentsSchema.parse(getQueryValues(context.req.raw));
  const resource = await rawFindExternalResource(getKey(context));
  if (!resource) {
    return context.json(
      {
        data: [],
        pagination: {
          limit: input.limit,
          offset: input.offset,
          total: 0,
          hasMore: false,
        },
      },
      { headers: { "content-type": "application/json; charset=UTF-8" } },
    );
  }
  return context.json(
    await listReviewsServices(resource.id, input.limit, input.offset),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actCreateExternalReview(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await createReviewServices(
      resource.id,
      createReviewSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    {
      status: 201,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
export async function actUpdateExternalReview(context: ApiContext) {
  return context.json(
    await updateReviewServices(
      getReviewId(context),
      updateReviewSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actDeleteExternalReview(context: ApiContext) {
  await deleteReviewServices(getReviewId(context), context.get("auth")!);
  return new Response(null, { status: 204 });
}
export async function actReactToExternalReview(context: ApiContext) {
  return context.json(
    await reactToReviewServices(
      uuidSchema.parse(
        externalResourceQuerySchema.parse(getQueryValues(context.req.raw)).id,
      ),
      reactionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveExternalReviewReaction(context: ApiContext) {
  await removeReviewReactionServices(
    uuidSchema.parse(
      externalResourceQuerySchema.parse(getQueryValues(context.req.raw)).id,
    ),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actReactToExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await reactToResourceServices(
      resource.id,
      reactionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveExternalResourceReaction(context: ApiContext) {
  const resource = await getProtectedResource(context);
  await removeResourceReactionServices(resource.id, context.get("auth")!);
  return new Response(null, { status: 204 });
}
export async function actVoteOnExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await voteOnResourceServices(
      resource.id,
      voteSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actSaveExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  const { list } = externalBookmarkQuerySchema.parse(getQueryValues(context.req.raw));
  return context.json(
    await saveResourceServices(
      resource.id,
      list,
      saveSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actUnsaveExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  const { list } = externalBookmarkQuerySchema.parse(getQueryValues(context.req.raw));
  await unsaveResourceServices(resource.id, list, context.get("auth")!);
  return new Response(null, { status: 204 });
}
export async function actRateExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await rateResourceServices(
      resource.id,
      ratingSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveExternalRating(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await removeRatingServices(resource.id, context.get("auth")!),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actFollowExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await followResourceServices(
      resource.id,
      followSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actUnfollowExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  await unfollowResourceServices(resource.id, context.get("auth")!);
  return new Response(null, { status: 204 });
}
export async function actSubscribeExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await subscribeResourceServices(
      resource.id,
      subscriptionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actUnsubscribeExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  await unsubscribeResourceServices(resource.id, context.get("auth")!);
  return new Response(null, { status: 204 });
}
export async function actShareExternalResource(context: ApiContext) {
  const resource = await getProtectedResource(context);
  return context.json(
    await shareResourceServices(
      resource.id,
      shareSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    {
      status: 201,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
export async function actReportExternalResource(context: ApiContext) {
  const key = getKey(context);
  const resource = await rawEnsureExternalResource(key, context.get("auth")!);
  const input = externalReportSchema.parse(await readRequestBody(context.req));
  return context.json(
    await createReportServices(
      {
        ...input,
        targetType: key.resourceType,
        targetId: key.resourceId,
        metadata: { resourceId: resource.id },
      },
      context.get("auth")!,
    ),
    {
      status: 201,
      headers: { "content-type": "application/json; charset=UTF-8" },
    },
  );
}
