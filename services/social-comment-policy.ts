import { and, eq } from "drizzle-orm";
import { database } from "@/database";
import { commentsTable, usersTable, resourcesTable } from "@/database/schema";
import { ServiceError } from "@/lib/errors";
import { assertSocialAccess } from "@/services/social-policy";
export async function rawAssertSocialCommentTarget(id: string, token: string) {
  const [row] = await database
    .select({
      resourceType: resourcesTable.resourceType,
      resourceId: resourcesTable.resourceId,
      subject: usersTable.externalUserId,
    })
    .from(commentsTable)
    .innerJoin(usersTable, eq(usersTable.id, commentsTable.authorUserId))
    .innerJoin(resourcesTable, eq(resourcesTable.id, commentsTable.resourceId))
    .where(
      and(eq(commentsTable.id, id), eq(resourcesTable.application, "social")),
    )
    .limit(1);
  if (!row) throw new ServiceError("comment_not_found", 404);
  const result = await assertSocialAccess(row, token, "read", [row.subject]);
  if (result.deniedSubjects.length)
    throw new ServiceError("comment_not_found", 404);
}
