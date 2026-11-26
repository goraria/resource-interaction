import { and, count, desc, eq } from "drizzle-orm"

import { database } from "@/database"
import { reviewsTable, usersTable } from "@/database/schema"
import { ServiceError } from "@/lib/errors"
import type { CreateReviewInput, UpdateReviewInput } from "@/schemas/reviews"
import { rawRequireActiveResourceById } from "@/models/resources"
import type { AuthContext } from "@/types/auth"

const reviewSelection = {
  id: reviewsTable.id,
  resourceId: reviewsTable.resourceId,
  title: reviewsTable.title,
  content: reviewsTable.content,
  containsSpoiler: reviewsTable.containsSpoiler,
  reactionCount: reviewsTable.reactionCount,
  createdAt: reviewsTable.createdAt,
  updatedAt: reviewsTable.updatedAt,
  editedAt: reviewsTable.editedAt,
  author: {
    id: usersTable.externalUserId,
    name: usersTable.name,
    username: usersTable.username,
    image: usersTable.image,
  },
}

export async function rawListReviews(resourceId: string, limit: number, offset: number) {
  await rawRequireActiveResourceById(resourceId)
  const where = and(
    eq(reviewsTable.resourceId, resourceId),
    eq(reviewsTable.status, "active"),
  )
  const [items, totals] = await Promise.all([
    database
      .select(reviewSelection)
      .from(reviewsTable)
      .innerJoin(usersTable, eq(reviewsTable.authorUserId, usersTable.id))
      .where(where)
      .orderBy(desc(reviewsTable.createdAt))
      .limit(limit)
      .offset(offset),
    database.select({ total: count() }).from(reviewsTable).where(where),
  ])
  const total = Number(totals[0]?.total ?? 0)
  return {
    data: items,
    pagination: { limit, offset, total, hasMore: offset + items.length < total },
  }
}

export async function rawCreateReview(
  resourceId: string,
  input: CreateReviewInput,
  auth: AuthContext,
) {
  await rawRequireActiveResourceById(resourceId)
  const [review] = await database
    .insert(reviewsTable)
    .values({
      resourceId,
      authorUserId: auth.user.id,
      title: input.title,
      content: input.content,
      containsSpoiler: input.containsSpoiler,
    })
    .onConflictDoUpdate({
      target: [reviewsTable.resourceId, reviewsTable.authorUserId],
      set: {
        title: input.title,
        content: input.content,
        containsSpoiler: input.containsSpoiler,
        status: "active",
        deletedAt: null,
        editedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  return review
}

export async function rawUpdateReview(id: string, input: UpdateReviewInput, auth: AuthContext) {
  const [review] = await database
    .update(reviewsTable)
    .set({ ...input, editedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(reviewsTable.id, id),
        eq(reviewsTable.authorUserId, auth.user.id),
        eq(reviewsTable.status, "active"),
      ),
    )
    .returning()
  if (!review) throw new ServiceError("review_not_found_or_forbidden", 404)
  return review
}

export async function rawDeleteReview(id: string, auth: AuthContext) {
  const [review] = await database
    .update(reviewsTable)
    .set({
      title: null,
      content: "",
      status: "deleted",
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(reviewsTable.id, id), eq(reviewsTable.authorUserId, auth.user.id)),
    )
    .returning()
  if (!review) throw new ServiceError("review_not_found_or_forbidden", 404)
  return review
}
