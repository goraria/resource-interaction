import { and, avg, count, desc, eq, sql } from "drizzle-orm";

import { database } from "@/database";
import {
  commentReactionsTable,
  commentsTable,
  ratingSummariesTable,
  ratingsTable,
  resourceFollowsTable,
  resourceReactionsTable,
  resourceSavesTable,
  resourceSubscriptionsTable,
  resourcesTable,
  reviewReactionsTable,
  reviewsTable,
  sharesTable,
} from "@/database/schema";
import { ServiceError } from "@/lib/errors";
import type {
  FollowInput,
  RatingInput,
  ReactionInput,
  SaveInput,
  ShareInput,
  SubscriptionInput,
  VoteInput,
} from "@/schemas/interactions";
import { rawRequireActiveResourceById } from "@/models/resources"
import type { AuthContext } from "@/types/auth";
import { rawAssertSocialCommentTarget } from "@/services/social-comment-policy";

export async function rawListMyFollows(
  auth: AuthContext,
  limit: number,
  offset: number,
) {
  return database
    .select({ follow: resourceFollowsTable, resource: resourcesTable })
    .from(resourceFollowsTable)
    .innerJoin(
      resourcesTable,
      eq(resourceFollowsTable.resourceId, resourcesTable.id),
    )
    .where(eq(resourceFollowsTable.userId, auth.user.id))
    .orderBy(desc(resourceFollowsTable.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function rawFollowResource(
  resourceId: string,
  input: FollowInput,
  auth: AuthContext,
) {
  await rawRequireActiveResourceById(resourceId);
  const [follow] = await database
    .insert(resourceFollowsTable)
    .values({
      resourceId,
      userId: auth.user.id,
      status: "accepted",
      notificationLevel: input.notificationLevel,
    })
    .onConflictDoUpdate({
      target: [resourceFollowsTable.userId, resourceFollowsTable.resourceId],
      set: {
        status: "accepted",
        notificationLevel: input.notificationLevel,
        updatedAt: new Date(),
      },
    })
    .returning();
  return follow;
}

export async function rawUnfollowResource(resourceId: string, auth: AuthContext) {
  await database
    .delete(resourceFollowsTable)
    .where(
      and(
        eq(resourceFollowsTable.resourceId, resourceId),
        eq(resourceFollowsTable.userId, auth.user.id),
      ),
    );
}

export async function rawSubscribeResource(
  resourceId: string,
  input: SubscriptionInput,
  auth: AuthContext,
) {
  await rawRequireActiveResourceById(resourceId);
  const [subscription] = await database
    .insert(resourceSubscriptionsTable)
    .values({
      resourceId,
      userId: auth.user.id,
      notificationLevel: input.notificationLevel,
    })
    .onConflictDoUpdate({
      target: [
        resourceSubscriptionsTable.userId,
        resourceSubscriptionsTable.resourceId,
      ],
      set: {
        notificationLevel: input.notificationLevel,
        updatedAt: new Date(),
      },
    })
    .returning();
  return subscription;
}

export async function rawUnsubscribeResource(
  resourceId: string,
  auth: AuthContext,
) {
  await database
    .delete(resourceSubscriptionsTable)
    .where(
      and(
        eq(resourceSubscriptionsTable.resourceId, resourceId),
        eq(resourceSubscriptionsTable.userId, auth.user.id),
      ),
    );
}

export async function rawGetMyResourceInteractionState(
  resourceId: string,
  auth: AuthContext,
) {
  await rawRequireActiveResourceById(resourceId);
  const [follow, subscription, saves, reaction, rating] = await Promise.all([
    database
      .select()
      .from(resourceFollowsTable)
      .where(
        and(
          eq(resourceFollowsTable.resourceId, resourceId),
          eq(resourceFollowsTable.userId, auth.user.id),
        ),
      )
      .limit(1),
    database
      .select()
      .from(resourceSubscriptionsTable)
      .where(
        and(
          eq(resourceSubscriptionsTable.resourceId, resourceId),
          eq(resourceSubscriptionsTable.userId, auth.user.id),
        ),
      )
      .limit(1),
    database
      .select({ type: resourceSavesTable.type })
      .from(resourceSavesTable)
      .where(
        and(
          eq(resourceSavesTable.resourceId, resourceId),
          eq(resourceSavesTable.userId, auth.user.id),
        ),
      ),
    database
      .select()
      .from(resourceReactionsTable)
      .where(
        and(
          eq(resourceReactionsTable.resourceId, resourceId),
          eq(resourceReactionsTable.userId, auth.user.id),
        ),
      )
      .limit(1),
    database
      .select()
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.resourceId, resourceId),
          eq(ratingsTable.userId, auth.user.id),
        ),
      )
      .limit(1),
  ]);

  return {
    followed: follow[0] ?? null,
    subscribed: subscription[0] ?? null,
    saves: saves.map((item) => item.type),
    reaction: reaction[0]?.type ?? null,
    rating: rating[0] ? Number(rating[0].value) : null,
  };
}

export async function rawListMySaves(
  auth: AuthContext,
  type: "bookmark" | "favorite" | undefined,
  limit: number,
  offset: number,
  resourceType?: string,
) {
  const userFilter = type
    ? and(
        eq(resourceSavesTable.userId, auth.user.id),
        eq(resourceSavesTable.type, type),
      )
    : eq(resourceSavesTable.userId, auth.user.id);
  const where = and(
    userFilter,
    ...(resourceType
      ? [
          eq(resourcesTable.resourceType, resourceType),
          eq(resourcesTable.application, auth.application),
        ]
      : []),
  );
  return database
    .select({ save: resourceSavesTable, resource: resourcesTable })
    .from(resourceSavesTable)
    .innerJoin(
      resourcesTable,
      eq(resourceSavesTable.resourceId, resourcesTable.id),
    )
    .where(where)
    .orderBy(desc(resourceSavesTable.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function rawSaveResource(
  resourceId: string,
  type: "bookmark" | "favorite",
  input: SaveInput,
  auth: AuthContext,
) {
  await rawRequireActiveResourceById(resourceId);
  const [save] = await database
    .insert(resourceSavesTable)
    .values({
      resourceId,
      userId: auth.user.id,
      type,
      metadata: input.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: [
        resourceSavesTable.resourceId,
        resourceSavesTable.userId,
        resourceSavesTable.type,
      ],
      set: { metadata: input.metadata ?? {} },
    })
    .returning();
  return save;
}

export async function rawUnsaveResource(
  resourceId: string,
  type: "bookmark" | "favorite",
  auth: AuthContext,
) {
  await database
    .delete(resourceSavesTable)
    .where(
      and(
        eq(resourceSavesTable.resourceId, resourceId),
        eq(resourceSavesTable.userId, auth.user.id),
        eq(resourceSavesTable.type, type),
      ),
    );
}

export async function rawGetResourceReactionSummary(resourceId: string) {
  await rawRequireActiveResourceById(resourceId);
  return database
    .select({ type: resourceReactionsTable.type, count: count() })
    .from(resourceReactionsTable)
    .where(eq(resourceReactionsTable.resourceId, resourceId))
    .groupBy(resourceReactionsTable.type);
}

export async function rawReactToResource(
  resourceId: string,
  input: ReactionInput,
  auth: AuthContext,
) {
  await rawRequireActiveResourceById(resourceId);
  const [reaction] = await database
    .insert(resourceReactionsTable)
    .values({ resourceId, userId: auth.user.id, type: input.type })
    .onConflictDoUpdate({
      target: [
        resourceReactionsTable.resourceId,
        resourceReactionsTable.userId,
      ],
      set: { type: input.type, updatedAt: new Date() },
    })
    .returning();
  return reaction;
}

export async function rawRemoveResourceReaction(
  resourceId: string,
  auth: AuthContext,
) {
  await database
    .delete(resourceReactionsTable)
    .where(
      and(
        eq(resourceReactionsTable.resourceId, resourceId),
        eq(resourceReactionsTable.userId, auth.user.id),
      ),
    );
}

export function rawVoteOnResource(
  resourceId: string,
  input: VoteInput,
  auth: AuthContext,
) {
  return rawReactToResource(
    resourceId,
    { type: input.value === 1 ? "upvote" : "downvote" },
    auth,
  );
}

export async function rawReactToComment(
  id: string,
  input: ReactionInput,
  auth: AuthContext,
  token = "",
) {
  if (auth.application === "social") await rawAssertSocialCommentTarget(id, token);
  return database.transaction(async (transaction) => {
    const [entity] = await transaction
      .select({ id: commentsTable.id, status: commentsTable.status })
      .from(commentsTable)
      .where(eq(commentsTable.id, id))
      .limit(1);
    if (!entity || entity.status !== "active") {
      throw new ServiceError("comment_not_found", 404);
    }

    const [existing] = await transaction
      .select({ userId: commentReactionsTable.userId })
      .from(commentReactionsTable)
      .where(
        and(
          eq(commentReactionsTable.commentId, id),
          eq(commentReactionsTable.userId, auth.user.id),
        ),
      )
      .limit(1);

    const [reaction] = await transaction
      .insert(commentReactionsTable)
      .values({ commentId: id, userId: auth.user.id, type: input.type })
      .onConflictDoUpdate({
        target: [commentReactionsTable.commentId, commentReactionsTable.userId],
        set: { type: input.type, updatedAt: new Date() },
      })
      .returning();

    if (!existing) {
      await transaction
        .update(commentsTable)
        .set({
          reactionCount: sql`${commentsTable.reactionCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(commentsTable.id, id));
    }

    return reaction;
  });
}

export async function rawRemoveCommentReaction(id: string, auth: AuthContext) {
  return database.transaction(async (transaction) => {
    const removed = await transaction
      .delete(commentReactionsTable)
      .where(
        and(
          eq(commentReactionsTable.commentId, id),
          eq(commentReactionsTable.userId, auth.user.id),
        ),
      )
      .returning({ userId: commentReactionsTable.userId });

    if (removed.length) {
      await transaction
        .update(commentsTable)
        .set({
          reactionCount: sql`GREATEST(${commentsTable.reactionCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(commentsTable.id, id));
    }
  });
}

export async function rawReactToReview(
  id: string,
  input: ReactionInput,
  auth: AuthContext,
) {
  return database.transaction(async (transaction) => {
    const [entity] = await transaction
      .select({ id: reviewsTable.id, status: reviewsTable.status })
      .from(reviewsTable)
      .where(eq(reviewsTable.id, id))
      .limit(1);
    if (!entity || entity.status !== "active") {
      throw new ServiceError("review_not_found", 404);
    }

    const [existing] = await transaction
      .select({ userId: reviewReactionsTable.userId })
      .from(reviewReactionsTable)
      .where(
        and(
          eq(reviewReactionsTable.reviewId, id),
          eq(reviewReactionsTable.userId, auth.user.id),
        ),
      )
      .limit(1);

    const [reaction] = await transaction
      .insert(reviewReactionsTable)
      .values({ reviewId: id, userId: auth.user.id, type: input.type })
      .onConflictDoUpdate({
        target: [reviewReactionsTable.reviewId, reviewReactionsTable.userId],
        set: { type: input.type, updatedAt: new Date() },
      })
      .returning();

    if (!existing) {
      await transaction
        .update(reviewsTable)
        .set({
          reactionCount: sql`${reviewsTable.reactionCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(reviewsTable.id, id));
    }

    return reaction;
  });
}

export async function rawRemoveReviewReaction(id: string, auth: AuthContext) {
  return database.transaction(async (transaction) => {
    const removed = await transaction
      .delete(reviewReactionsTable)
      .where(
        and(
          eq(reviewReactionsTable.reviewId, id),
          eq(reviewReactionsTable.userId, auth.user.id),
        ),
      )
      .returning({ userId: reviewReactionsTable.userId });

    if (removed.length) {
      await transaction
        .update(reviewsTable)
        .set({
          reactionCount: sql`GREATEST(${reviewsTable.reactionCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(reviewsTable.id, id));
    }
  });
}

async function refreshRatingSummary(resourceId: string) {
  const [aggregate] = await database
    .select({ count: count(), average: avg(ratingsTable.value) })
    .from(ratingsTable)
    .where(eq(ratingsTable.resourceId, resourceId));
  const distributionRows = await database
    .select({ value: ratingsTable.value, count: count() })
    .from(ratingsTable)
    .where(eq(ratingsTable.resourceId, resourceId))
    .groupBy(ratingsTable.value);
  const distribution = Object.fromEntries(
    distributionRows.map((row) => [row.value, Number(row.count)]),
  );

  const [summary] = await database
    .insert(ratingSummariesTable)
    .values({
      resourceId,
      ratingCount: Number(aggregate?.count ?? 0),
      averageRating: String(aggregate?.average ?? 0),
      distribution,
    })
    .onConflictDoUpdate({
      target: ratingSummariesTable.resourceId,
      set: {
        ratingCount: Number(aggregate?.count ?? 0),
        averageRating: String(aggregate?.average ?? 0),
        distribution,
        updatedAt: new Date(),
      },
    })
    .returning();
  return summary;
}

export async function rawGetRatingSummary(resourceId: string) {
  await rawRequireActiveResourceById(resourceId);
  const [summary] = await database
    .select()
    .from(ratingSummariesTable)
    .where(eq(ratingSummariesTable.resourceId, resourceId))
    .limit(1);
  return (
    summary ?? {
      resourceId,
      ratingCount: 0,
      averageRating: "0",
      distribution: {},
    }
  );
}

export async function rawRateResource(
  resourceId: string,
  input: RatingInput,
  auth: AuthContext,
) {
  await rawRequireActiveResourceById(resourceId);
  await database
    .insert(ratingsTable)
    .values({ resourceId, userId: auth.user.id, value: String(input.value) })
    .onConflictDoUpdate({
      target: [ratingsTable.resourceId, ratingsTable.userId],
      set: { value: String(input.value), updatedAt: new Date() },
    });
  return refreshRatingSummary(resourceId);
}

export async function rawRemoveRating(resourceId: string, auth: AuthContext) {
  await database
    .delete(ratingsTable)
    .where(
      and(
        eq(ratingsTable.resourceId, resourceId),
        eq(ratingsTable.userId, auth.user.id),
      ),
    );
  return refreshRatingSummary(resourceId);
}

export async function rawShareResource(
  resourceId: string,
  input: ShareInput,
  auth: AuthContext,
) {
  await rawRequireActiveResourceById(resourceId);
  const [share] = await database
    .insert(sharesTable)
    .values({
      resourceId,
      userId: auth.user.id,
      channel: input.channel,
      destination: input.destination,
      metadata: input.metadata ?? {},
    })
    .returning();
  return share;
}
