import { HTTPError } from "nitro/h3";
import { eq } from "drizzle-orm";
import { database } from "@/database";
import { usersTable } from "@/database/schema";
import type { User } from "@/database/schema";
import { authUrl } from "@/utils/environment";
import { formatServiceProfile } from "@/utils/formatter";
import {
  createProfileProvisioner, fetchServiceProfile, isServiceProfileFresh,
} from "@/modules/structure/user-profile";

const provisionProfile = createProfileProvisioner<User>();

export async function rawGetServiceUser(subject: string, accessToken: string): Promise<User> {
  const [existing] = await database
    .select()
    .from(usersTable)
    .where(eq(usersTable.externalUserId, subject))
    .limit(1);
  if (existing && isServiceProfileFresh(existing.lastSeenAt)) return existing;
  return provisionProfile(subject, async () => {
    const parsed = await fetchServiceProfile(authUrl, subject, accessToken);
    const profile = formatServiceProfile(parsed);
    const [user] = await database
      .insert(usersTable)
      .values(profile)
      .onConflictDoUpdate({
        target: usersTable.externalUserId,
        set: { ...profile, updatedAt: new Date() },
      })
      .returning();
    if (!user)
      throw new HTTPError({
        status: 503,
        message: "auth_unavailable",
      });
    return user;
  });
}
