import { and, eq } from "drizzle-orm";
import { database } from "@/database";
import {
  commentsTable,
  resourcesTable,
  reviewsTable,
  verifiedReferencesTable,
} from "@/database/schema";
import { ServiceError } from "@/lib/errors";
import { uuidSchema } from "@/schemas/common";
import { rawReadTaskPageGrants } from "@/models/task-policy-projection";
import { assertSocialAccess } from "@/services/social-policy";
import { assertReaderAccess } from "@/services/reader-policy";
import { assertVideoAccess } from "@/services/video-policy";
import type { AuthContext } from "@/types/auth";
import type {
  TaskResourceAccess,
  TaskResourceLookup,
  TaskResourceReference,
} from "@/utils/interface";

const resourceSelection = {
  application: resourcesTable.application,
  resourceType: resourcesTable.resourceType,
  resourceId: resourcesTable.resourceId,
};
export async function rawFindTaskRequestResource(
  input: TaskResourceLookup,
): Promise<TaskResourceReference | null> {
  try {
    if (input.commentId || input.reviewId || input.referenceId) {
      const table = input.commentId
        ? commentsTable
        : input.reviewId
          ? reviewsTable
          : verifiedReferencesTable;
      const id = uuidSchema.parse(
        input.commentId ?? input.reviewId ?? input.referenceId,
      );
      const [reference] = await database
        .select(resourceSelection)
        .from(table)
        .innerJoin(resourcesTable, eq(table.resourceId, resourcesTable.id))
        .where(eq(table.id, id))
        .limit(1);
      return reference ?? null;
    }
    if (input.entityId) {
      const [reference] = await database
        .select(resourceSelection)
        .from(resourcesTable)
        .where(eq(resourcesTable.id, uuidSchema.parse(input.entityId)))
        .limit(1);
      return reference ?? null;
    }
    if (input.resourceType && input.resourceId) {
      const [reference] = await database
        .select(resourceSelection)
        .from(resourcesTable)
        .where(
          and(
            eq(resourcesTable.resourceType, input.resourceType),
            eq(resourcesTable.resourceId, input.resourceId),
            eq(resourcesTable.status, "active"),
            ...(input.application
              ? [eq(resourcesTable.application, input.application)]
              : []),
          ),
        )
        .limit(1);
      return reference ?? null;
    }
    return null;
  } catch (error) {
    throw error;
  }
}

export async function rawAssertTaskResourceAccess(
  reference: TaskResourceReference,
  auth: AuthContext,
  access: TaskResourceAccess,
) {
  if (reference.application !== "task") return;
  if (reference.resourceType !== "page")
    throw new ServiceError("task_resource_type_not_supported", 403);
  if (auth.application !== "task" || !auth.user.externalUserId)
    throw new ServiceError("task_resource_forbidden", 403);
  const pageId = uuidSchema.parse(reference.resourceId);
  const allowed = await rawReadTaskPageGrants(
    auth.user.externalUserId,
    [pageId],
    access,
  );
  if (!allowed.has(pageId))
    throw new ServiceError("task_resource_forbidden", 403);
}

// Saved entries are user-owned, but Task workspace access can be revoked.
// Filter in one authorized batch rather than a separate network call per page.
export async function rawFilterTaskResourceRecords<
  T extends { resource: TaskResourceReference },
>(items: T[], auth: AuthContext, bearer?: string): Promise<T[]> {
  const video=items.filter(item=>item.resource.application==='video');
  if(video.length){const allowed=new Set<string>();if(auth.application==='video'&&bearer)for(let i=0;i<video.length;i+=8)await Promise.all(video.slice(i,i+8).map(async item=>{try{await assertVideoAccess(item.resource,bearer);allowed.add(item.resource.resourceId)}catch{}}));items=items.filter(item=>item.resource.application!=='video'||allowed.has(item.resource.resourceId));}
  const reader = items.filter((item) => item.resource.application === "reader");
  if (reader.length) {
    const allowed = new Set<string>();
    if (auth.application === "reader" && bearer)
      for (let i = 0; i < reader.length; i += 8)
        await Promise.all(
          reader.slice(i, i + 8).map(async (item) => {
            try {
              await assertReaderAccess(item.resource, bearer);
              allowed.add(item.resource.resourceId);
            } catch {}
          }),
        );
    items = items.filter(
      (item) =>
        item.resource.application !== "reader" ||
        allowed.has(item.resource.resourceId),
    );
  }
  const social = items.filter((item) => item.resource.application === "social");
  if (social.length) {
    const allowed = new Set<string>();
    if (auth.application === "social" && bearer) {
      for (let i = 0; i < social.length; i += 8)
        await Promise.all(
          social.slice(i, i + 8).map(async (item) => {
            try {
              await assertSocialAccess(item.resource, bearer);
              allowed.add(item.resource.resourceId);
            } catch {}
          }),
        );
    }
    items = items.filter(
      (item) =>
        item.resource.application !== "social" ||
        allowed.has(item.resource.resourceId),
    );
  }
  const task = items.filter((item) => item.resource.application === "task");
  if (!task.length) return items;
  if (auth.application !== "task")
    return items.filter((item) => item.resource.application !== "task");
  const ids = [
    ...new Set(
      task
        .filter((item) => item.resource.resourceType === "page")
        .map((item) => uuidSchema.parse(item.resource.resourceId)),
    ),
  ];
  if (!ids.length)
    return items.filter((item) => item.resource.application !== "task");
  const allowed = await rawReadTaskPageGrants(
    auth.user.externalUserId,
    ids,
    "read",
  );
  return items.filter(
    (item) =>
      item.resource.application !== "task" ||
      (item.resource.resourceType === "page" &&
        allowed.has(item.resource.resourceId)),
  );
}
