import { and, asc, desc, eq, or, ne } from "drizzle-orm";

import { database } from "@/database";
import {
  collectionResourcesTable,
  collectionsTable,
  resourcesTable,
} from "@/database/schema";
import { ServiceError } from "@/lib/errors";
import type {
  AddCollectionResourceInput,
  CreateCollectionInput,
  UpdateCollectionInput,
} from "@/schemas/collections";
import { rawRequireActiveResourceById } from "@/models/resources"
import type { AuthContext } from "@/types/auth";

async function checkCollectionOwnership(id: string, auth: AuthContext) {
  const [collection] = await database
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.id, id))
    .limit(1);
  if (!collection) throw new ServiceError("collection_not_found", 404);
  if (collection.userId !== auth.user.id) {
    throw new ServiceError("collection_forbidden", 403);
  }
  return collection;
}

export async function rawListMyCollections(
  auth: AuthContext,
  limit: number,
  offset: number,
) {
  return database
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.userId, auth.user.id))
    .orderBy(desc(collectionsTable.updatedAt))
    .limit(limit)
    .offset(offset);
}

export async function rawGetCollection(id: string, auth?: AuthContext) {
  const visibility = auth
    ? or(
        eq(collectionsTable.visibility, "public"),
        eq(collectionsTable.visibility, "unlisted"),
        eq(collectionsTable.userId, auth.user.id),
      )
    : or(
        eq(collectionsTable.visibility, "public"),
        eq(collectionsTable.visibility, "unlisted"),
      );
  const [collection] = await database
    .select()
    .from(collectionsTable)
    .where(and(eq(collectionsTable.id, id), visibility))
    .limit(1);
  if (!collection) throw new ServiceError("collection_not_found", 404);
  return collection;
}

export async function rawCreateCollection(
  input: CreateCollectionInput,
  auth: AuthContext,
) {
  const [collection] = await database
    .insert(collectionsTable)
    .values({
      userId: auth.user.id,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      metadata: input.metadata ?? {},
    })
    .returning();
  return collection;
}

export async function rawUpdateCollection(
  id: string,
  input: UpdateCollectionInput,
  auth: AuthContext,
) {
  await checkCollectionOwnership(id, auth);
  const [collection] = await database
    .update(collectionsTable)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(collectionsTable.id, id))
    .returning();
  return collection;
}

export async function rawDeleteCollection(id: string, auth: AuthContext) {
  await checkCollectionOwnership(id, auth);
  await database.delete(collectionsTable).where(eq(collectionsTable.id, id));
}

export async function rawListCollectionResources(id: string, auth?: AuthContext) {
  await rawGetCollection(id, auth);
  return database
    .select({
      collectionResource: collectionResourcesTable,
      resource: resourcesTable,
    })
    .from(collectionResourcesTable)
    .innerJoin(
      resourcesTable,
      eq(collectionResourcesTable.resourceId, resourcesTable.id),
    )
    .where(
      and(
        eq(collectionResourcesTable.collectionId, id),
        ne(resourcesTable.application, "task"),
        ne(resourcesTable.application, "social"),
        ne(resourcesTable.application, "reader"),
      ),
    )
    .orderBy(
      asc(collectionResourcesTable.position),
      asc(collectionResourcesTable.addedAt),
    );
}

export async function rawAddCollectionResource(
  collectionId: string,
  resourceId: string,
  input: AddCollectionResourceInput,
  auth: AuthContext,
) {
  await checkCollectionOwnership(collectionId, auth);
  await rawRequireActiveResourceById(resourceId);
  const [item] = await database
    .insert(collectionResourcesTable)
    .values({ collectionId, resourceId, position: input.position })
    .onConflictDoUpdate({
      target: [
        collectionResourcesTable.collectionId,
        collectionResourcesTable.resourceId,
      ],
      set: { position: input.position, addedAt: new Date() },
    })
    .returning();
  return item;
}

export async function rawRemoveCollectionResource(
  collectionId: string,
  resourceId: string,
  auth: AuthContext,
) {
  await checkCollectionOwnership(collectionId, auth);
  await database
    .delete(collectionResourcesTable)
    .where(
      and(
        eq(collectionResourcesTable.collectionId, collectionId),
        eq(collectionResourcesTable.resourceId, resourceId),
      ),
    );
}
