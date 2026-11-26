import { and, count, desc, eq, isNull, sql } from "drizzle-orm"
import { database } from "@/database"
import { commentsTable, usersTable } from "@/database/schema"
import { ServiceError } from "@/lib/errors"
import { type CreateCommentInput, type ListCommentsInput, type UpdateCommentInput } from "@/schemas/comments"
import { rawRequireActiveResourceById } from "@/models/resources"
import { type AuthContext } from "@/types/auth"
import { assertSocialAccess } from "@/services/social-policy"
import { rawAssertSocialCommentTarget } from "@/services/social-comment-policy"
import { type z } from "zod"
import { type readerCommentModeration } from "@/schemas/reader-moderation"

const commentSelection = {
  id: commentsTable.id,
  resourceId: commentsTable.resourceId,
  rootId: commentsTable.rootId,
  parentId: commentsTable.parentId,
  content: commentsTable.content,
  status: commentsTable.status,
  isPinned: commentsTable.isPinned,
  reactionCount: commentsTable.reactionCount,
  replyCount: commentsTable.replyCount,
  createdAt: commentsTable.createdAt,
  updatedAt: commentsTable.updatedAt,
  editedAt: commentsTable.editedAt,
  author: {
    id: usersTable.externalUserId,
    name: usersTable.name,
    username: usersTable.username,
    image: usersTable.image,
  },
};

export async function rawListComments(
  resourceId: string,
  input: ListCommentsInput,
  token = "",
) {
  const resource = await rawRequireActiveResourceById(resourceId);
  if (resource.application === "social" && input.parentId)
    await rawAssertSocialCommentTarget(input.parentId, token);
  const parentFilter = input.parentId
    ? eq(commentsTable.parentId, input.parentId)
    : isNull(commentsTable.parentId);
  const where = and(
    eq(commentsTable.resourceId, resourceId),
    eq(commentsTable.status, "active"),
    parentFilter,
  );

  const [items, totals] = await Promise.all([
    database
      .select(commentSelection)
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.authorUserId, usersTable.id))
      .where(where)
      .orderBy(desc(commentsTable.isPinned), desc(commentsTable.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    database.select({ total: count() }).from(commentsTable).where(where),
  ]);
  const total = Number(totals[0]?.total ?? 0);

  const denied =
    resource.application === "social"
      ? (
          await assertSocialAccess(
            resource,
            token,
            "read",
            items.map((i) => i.author.id),
          )
        ).deniedSubjects
      : [];
  return {
    data: items.filter((i) => !denied.includes(i.author.id)),
    pagination: {
      limit: input.limit,
      offset: input.offset,
      total,
      hasMore: input.offset + items.length < total,
    },
  };
}

export async function rawCreateComment(
  resourceId: string,
  input: CreateCommentInput,
  auth: AuthContext,
  token = "",
) {
  await rawRequireActiveResourceById(resourceId);
  if (auth.application === "social" && input.parentId)
    await rawAssertSocialCommentTarget(input.parentId, token);

  return database.transaction(async (transaction) => {
    if (["social", "reader", "video"].includes(auth.application)) {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtextextended(${auth.user.id},0))`,
      );
      const recent = await transaction.execute(
        sql`SELECT count(*)::int n FROM ${commentsTable} WHERE ${commentsTable.authorUserId}=${auth.user.id}::uuid AND ${commentsTable.createdAt}>clock_timestamp()-interval '1 minute'`,
      );
      if (Number(recent.rows[0]?.n) >= 30)
        throw new ServiceError("comment_rate_limited", 429);
    }
    let rootId: string | null = null;
    if (input.parentId) {
      const [parent] = await transaction
        .select({
          id: commentsTable.id,
          resourceId: commentsTable.resourceId,
          rootId: commentsTable.rootId,
          status: commentsTable.status,
        })
        .from(commentsTable)
        .where(eq(commentsTable.id, input.parentId))
        .limit(1)
        .for("update");

      if (
        !parent ||
        parent.resourceId !== resourceId ||
        parent.status !== "active"
      ) {
        throw new ServiceError("parent_comment_not_found", 404);
      }
      rootId = parent.rootId ?? parent.id;
    }

    const [comment] = await transaction
      .insert(commentsTable)
      .values({
        resourceId,
        authorUserId: auth.user.id,
        rootId,
        parentId: input.parentId ?? null,
        content: input.content,
      })
      .returning();

    if (!comment) throw new ServiceError("comment_create_failed", 409);

    if (input.parentId) {
      await transaction
        .update(commentsTable)
        .set({
          replyCount: sql`${commentsTable.replyCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(commentsTable.id, input.parentId));
    }

    return comment;
  });
}

export async function rawUpdateComment(
  id: string,
  input: UpdateCommentInput,
  auth: AuthContext,
) {
  const [comment] = await database
    .update(commentsTable)
    .set({
      content: input.content,
      editedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(commentsTable.id, id),
        eq(commentsTable.authorUserId, auth.user.id),
        eq(commentsTable.status, "active"),
      ),
    )
    .returning();

  if (!comment) throw new ServiceError("comment_not_found_or_forbidden", 404);
  return comment;
}

export async function rawDeleteComment(id: string, auth: AuthContext) {
  return database.transaction(async (transaction) => {
    const [comment] = await transaction
      .select()
      .from(commentsTable)
      .where(eq(commentsTable.id, id))
      .limit(1)
      .for("update");

    if (!comment || comment.authorUserId !== auth.user.id) {
      throw new ServiceError("comment_not_found_or_forbidden", 404);
    }
    // Repeated deletion must not decrement the parent's reply counter twice.
    if (comment.status === "deleted") return comment;

    const [deleted] = await transaction
      .update(commentsTable)
      .set({
        content: "",
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(commentsTable.id, id))
      .returning();

    if (
      comment.parentId &&
      (auth.application !== "reader" || comment.status === "active")
    ) {
      await transaction
        .update(commentsTable)
        .set({
          replyCount: sql`GREATEST(${commentsTable.replyCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(commentsTable.id, comment.parentId));
    }

    return deleted;
  });
}

export async function rawModerateReaderCommentManagement(
  id: string,
  input: z.infer<typeof readerCommentModeration>,
  auth: AuthContext,
) {
  if (
    auth.application !== "reader" ||
    !["admin", "master"].includes(auth.user.role)
  )
    throw new ServiceError("reader_moderator_required", 403);
  return database.transaction(async (tx) => {
    const row = (
      await tx.execute(
        sql`SELECT c.id,c.status,c.parent_id FROM comments c JOIN resources r ON r.id=c.resource_id WHERE c.id=${id}::uuid AND r.application='reader' FOR UPDATE OF c`,
      )
    ).rows[0] as
      { id: string; status: string; parent_id: string | null } | undefined;
    if (!row || row.status === "deleted")
      throw new ServiceError("comment_not_found", 404);
    const status = input.hidden ? "hidden" : "active";
    if (row.status !== status) {
      await tx.execute(
        sql`UPDATE comments SET status=${status}::interaction_status,updated_at=clock_timestamp() WHERE id=${id}::uuid`,
      );
      if (row.parent_id)
        await tx.execute(
          sql`UPDATE comments SET reply_count=GREATEST(reply_count+${input.hidden ? -1 : 1},0),updated_at=clock_timestamp() WHERE id=${row.parent_id}::uuid`,
        );
    }
    await tx.execute(
      sql`UPDATE reports SET status='resolved',resolution=${input.reason},resolved_by_user_id=${auth.user.id}::uuid,resolved_at=clock_timestamp(),updated_at=clock_timestamp() WHERE target_type='comment' AND target_id=${id} AND metadata->>'application'='reader' AND status IN('open','reviewing')`,
    );
    return { id, status };
  });
}
