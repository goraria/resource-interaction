import { and, eq, ne, asc, count, desc, sql } from "drizzle-orm"
import { database } from "@/database"
import { resourcesTable, resourceCountersTable, verifiedReferencesTable } from "@/database/schema"
import { ServiceError } from "@/lib/errors"
import { type AuthContext } from "@/utils/interface"
import { type CounterMutationInput, type CreateResourceInput, type ListResourcesInput, type UpdateResourceInput, type VerifiedReferenceInput } from "@/schemas/resources"
import { type ExternalResourceKey } from "@/schemas/external-resources"
import { rawGetRatingSummary, rawGetResourceReactionSummary } from "@/services/interactions"

export async function rawListResources(input: ListResourcesInput) {
  const filters = [
    eq(resourcesTable.status, input.status),
    ne(resourcesTable.application, "task"),
    ne(resourcesTable.application, "social"),
    ne(resourcesTable.application, "reader"),
    ne(resourcesTable.application, "video"),
  ];
  if (input.application)
    filters.push(eq(resourcesTable.application, input.application));
  if (input.resourceType)
    filters.push(eq(resourcesTable.resourceType, input.resourceType));
  if (input.resourceId)
    filters.push(eq(resourcesTable.resourceId, input.resourceId));
  if (input.owner)
    filters.push(eq(resourcesTable.ownerExternalUserId, input.owner));

  const where = and(...filters);
  const [items, totals] = await Promise.all([
    database
      .select()
      .from(resourcesTable)
      .where(where)
      .orderBy(desc(resourcesTable.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    database.select({ total: count() }).from(resourcesTable).where(where),
  ]);

  const total = Number(totals[0]?.total ?? 0);
  return {
    data: items,
    pagination: {
      limit: input.limit,
      offset: input.offset,
      total,
      hasMore: input.offset + items.length < total,
    },
  };
}

export async function rawResolveResource(input: {
  application: string;
  resourceType: string;
  resourceId: string;
}) {
  const [resource] = await database
    .select()
    .from(resourcesTable)
    .where(
      and(
        eq(resourcesTable.application, input.application),
        eq(resourcesTable.resourceType, input.resourceType),
        eq(resourcesTable.resourceId, input.resourceId),
        eq(resourcesTable.status, "active"),
      ),
    )
    .limit(1);

  if (!resource) throw new ServiceError("resource_not_found", 404);
  return resource;
}

export async function rawGetResource(id: string) {
  return rawRequireActiveResourceById(id);
}

export async function rawCreateResource(
  input: CreateResourceInput,
  auth: AuthContext,
) {
  if (["reader","video"].includes(auth.application))
    throw new ServiceError(`${auth.application}_source_managed_by_app`, 403);
  if (auth.application === "social")
    throw new ServiceError("social_source_managed_by_app", 403);
  const [inserted] = await database
    .insert(resourcesTable)
    .values({
      application: auth.application,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ownerExternalUserId: auth.user.externalUserId,
      title: input.title,
      canonicalUrl: input.canonicalUrl,
      imageUrl: input.imageUrl,
      metadata: input.metadata ?? {},
    })
    .onConflictDoNothing()
    .returning();

  if (inserted) return inserted;

  const [existing] = await database
    .select()
    .from(resourcesTable)
    .where(
      and(
        eq(resourcesTable.application, auth.application),
        eq(resourcesTable.resourceType, input.resourceType),
        eq(resourcesTable.resourceId, input.resourceId),
      ),
    )
    .limit(1);

  if (!existing) throw new ServiceError("resource_create_failed", 409);
  if (existing.ownerExternalUserId !== auth.user.externalUserId) {
    throw new ServiceError("resource_owner_conflict", 409);
  }

  const [updated] = await database
    .update(resourcesTable)
    .set({
      title: input.title,
      canonicalUrl: input.canonicalUrl,
      imageUrl: input.imageUrl,
      metadata: input.metadata ?? {},
      status: "active",
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(resourcesTable.id, existing.id))
    .returning();

  if (!updated) throw new ServiceError("resource_create_failed", 409);
  return updated;
}

export async function rawUpdateResource(
  id: string,
  input: UpdateResourceInput,
  auth: AuthContext,
) {
  if (["reader","video"].includes(auth.application))
    throw new ServiceError(`${auth.application}_source_managed_by_app`, 403);
  if (auth.application === "social")
    throw new ServiceError("social_source_managed_by_app", 403);
  await rawCheckResourceOwnership(id, auth);
  const [resource] = await database
    .update(resourcesTable)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(resourcesTable.id, id))
    .returning();
  if (!resource) throw new ServiceError("resource_not_found", 404);
  return resource;
}

export async function rawDeleteResource(id: string, auth: AuthContext) {
  if (["reader","video"].includes(auth.application))
    throw new ServiceError(`${auth.application}_source_managed_by_app`, 403);
  if (auth.application === "social")
    throw new ServiceError("social_source_managed_by_app", 403);
  await rawCheckResourceOwnership(id, auth);
  const [resource] = await database
    .update(resourcesTable)
    .set({ status: "deleted", deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(resourcesTable.id, id))
    .returning();
  if (!resource) throw new ServiceError("resource_not_found", 404);
  return resource;
}

export async function rawListResourceCounters(resourceId: string) {
  await rawRequireActiveResourceById(resourceId);
  return database
    .select()
    .from(resourceCountersTable)
    .where(eq(resourceCountersTable.resourceId, resourceId))
    .orderBy(asc(resourceCountersTable.key));
}

export async function rawUpdateResourceCounter(
  resourceId: string,
  key: string,
  input: CounterMutationInput,
  auth: AuthContext,
) {
  await rawCheckResourceOwnership(resourceId, auth);
  if (!/^[a-z0-9:_-]{1,64}$/.test(key)) {
    throw new ServiceError("invalid_counter_key", 400);
  }

  const delta = input.delta ?? 0;
  const initialValue = input.value ?? Math.max(delta, 0);
  const value =
    input.value !== undefined
      ? sql`${input.value}`
      : sql`GREATEST(${resourceCountersTable.value} + ${delta}, 0)`;

  const [counter] = await database
    .insert(resourceCountersTable)
    .values({ resourceId, key, value: initialValue })
    .onConflictDoUpdate({
      target: [resourceCountersTable.resourceId, resourceCountersTable.key],
      set: { value, updatedAt: new Date() },
    })
    .returning();

  return counter;
}

export async function rawListVerifiedReferences(resourceId: string) {
  await rawRequireActiveResourceById(resourceId);
  return database
    .select()
    .from(verifiedReferencesTable)
    .where(eq(verifiedReferencesTable.resourceId, resourceId))
    .orderBy(desc(verifiedReferencesTable.verifiedAt));
}

export async function rawCreateVerifiedReference(
  resourceId: string,
  input: VerifiedReferenceInput,
  auth: AuthContext,
) {
  await rawCheckResourceOwnership(resourceId, auth);
  const [reference] = await database
    .insert(verifiedReferencesTable)
    .values({
      resourceId,
      userId: auth.user.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadata: input.metadata ?? {},
    })
    .onConflictDoUpdate({
      target: [
        verifiedReferencesTable.resourceId,
        verifiedReferencesTable.userId,
        verifiedReferencesTable.sourceType,
        verifiedReferencesTable.sourceId,
      ],
      set: { metadata: input.metadata ?? {}, verifiedAt: new Date() },
    })
    .returning();
  return reference;
}

export async function rawDeleteVerifiedReference(id: string, auth: AuthContext) {
  const [reference] = await database
    .select({
      id: verifiedReferencesTable.id,
      resourceId: verifiedReferencesTable.resourceId,
      userId: verifiedReferencesTable.userId,
    })
    .from(verifiedReferencesTable)
    .where(eq(verifiedReferencesTable.id, id))
    .limit(1);

  if (!reference) throw new ServiceError("verified_reference_not_found", 404);
  await rawCheckResourceOwnership(reference.resourceId, auth);
  if (reference.userId !== auth.user.id) {
    throw new ServiceError("verified_reference_forbidden", 403);
  }

  await database
    .delete(verifiedReferencesTable)
    .where(eq(verifiedReferencesTable.id, id));
}

interface ExternalResourceLookup extends ExternalResourceKey {
  application?: string
}

export async function rawFindExternalResource(key: ExternalResourceLookup) {
  const filters = [
    eq(resourcesTable.resourceType, key.resourceType),
    eq(resourcesTable.resourceId, key.resourceId),
    eq(resourcesTable.status, "active"),
  ]
  if (key.application) {
    filters.push(eq(resourcesTable.application, key.application))
  }

  const [resource] = await database
    .select()
    .from(resourcesTable)
    .where(and(...filters))
    .limit(1)
  return resource ?? null
}

export async function rawEnsureExternalResource(
  key: ExternalResourceKey,
  auth: AuthContext,
) {
  const scopedKey = { ...key, application: auth.application }
  const existing = await rawFindExternalResource(scopedKey)
  if (existing) return existing

  await database
    .insert(resourcesTable)
    .values({
      application: auth.application,
      resourceType: key.resourceType,
      resourceId: key.resourceId,
      ownerExternalUserId: null,
    })
    .onConflictDoNothing()

  const resource = await rawFindExternalResource(scopedKey)
  if (!resource) throw new ServiceError("resource_create_failed", 409)
  return resource
}

export async function rawGetExternalResourceSummary(key: ExternalResourceKey) {
  const resource = await rawFindExternalResource(key)
  if (!resource) {
    return {
      resource: null,
      reactions: [],
      rating: {
        resourceId: null,
        ratingCount: 0,
        averageRating: "0",
        distribution: {},
      },
    }
  }

  const [reactions, rating] = await Promise.all([
    rawGetResourceReactionSummary(resource.id),
    rawGetRatingSummary(resource.id),
  ])
  return { resource, reactions, rating }
}

export async function rawRequireActiveResourceById(id: string) {
  const [resource] = await database
    .select()
    .from(resourcesTable)
    .where(and(eq(resourcesTable.id, id), eq(resourcesTable.status, "active")))
    .limit(1)

  if (!resource) throw new ServiceError("resource_not_found", 404)
  return resource
}

export async function rawCheckResourceOwnership(id: string, auth: AuthContext) {
  const [resource] = await database
    .select()
    .from(resourcesTable)
    .where(and(eq(resourcesTable.id, id), ne(resourcesTable.status, "deleted")))
    .limit(1)
  if (!resource) throw new ServiceError("resource_not_found", 404)
  if (
    resource.application !== auth.application ||
    resource.ownerExternalUserId !== auth.user.externalUserId
  ) {
    throw new ServiceError("resource_forbidden", 403)
  }
  return resource
}
