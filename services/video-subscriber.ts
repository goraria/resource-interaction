import { and, asc, eq, gt, count } from "drizzle-orm";
import { database } from "@/database";
import {
  resourcesTable,
  resourceSubscriptionsTable,
  usersTable,
} from "@/database/schema";
export async function rawReadVideoChannelStats(channelId: string) {
  const [row] = await database
    .select({ subscribers: count() })
    .from(resourceSubscriptionsTable)
    .innerJoin(
      resourcesTable,
      eq(resourcesTable.id, resourceSubscriptionsTable.resourceId),
    )
    .where(
      and(
        eq(resourcesTable.application, "video"),
        eq(resourcesTable.resourceType, "channel"),
        eq(resourcesTable.resourceId, channelId),
        eq(resourcesTable.status, "active"),
      ),
    );
  return { subscribers: Number(row?.subscribers ?? 0) };
}
export async function rawListVideoSubscribers(
  channelId: string,
  cursor: string | null,
) {
  const data = await database
    .select({
      id: usersTable.id,
      subject: usersTable.externalUserId,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(resourceSubscriptionsTable)
    .innerJoin(
      resourcesTable,
      eq(resourcesTable.id, resourceSubscriptionsTable.resourceId),
    )
    .innerJoin(usersTable, eq(usersTable.id, resourceSubscriptionsTable.userId))
    .where(
      and(
        eq(resourcesTable.application, "video"),
        eq(resourcesTable.resourceType, "channel"),
        eq(resourcesTable.resourceId, channelId),
        eq(resourcesTable.status, "active"),
        eq(resourceSubscriptionsTable.notificationLevel, "all"),
        ...(cursor ? [gt(usersTable.id, cursor)] : []),
      ),
    )
    .orderBy(asc(usersTable.id))
    .limit(8);
  return { data, nextCursor: data.length === 8 ? data.at(-1)!.id : null };
}
