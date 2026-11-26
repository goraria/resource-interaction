import { HTTPError } from "nitro/h3";
import { eq } from "drizzle-orm";
import { database } from "@/database";
import { usersTable } from "@/database/schema";
import type { User } from "@/database/schema";
import { ssoProfileSchema } from "@/schemas/auth";
import { authUrl } from "@/utils/environment";
import { formatServiceProfile } from "@/utils/formatter";
// Provision/profile refresh only. JWT auth never depends on UserInfo for every call.
// Keep profile freshness bounded without re-writing the user on every API request.
const profileMaxAgeMs = 600000;
const provisioning = new Map<string, Promise<User>>();
export async function rawGetServiceUser(
  subject: string,
  accessToken: string,
): Promise<User> {
  const [existing] = await database
    .select()
    .from(usersTable)
    .where(eq(usersTable.externalUserId, subject))
    .limit(1);
  if (existing) {
    const checkedAt = existing.lastSeenAt?.getTime() ?? 0;
    if (checkedAt <= Date.now() && checkedAt > Date.now() - profileMaxAgeMs)
      return existing;
  }
  const current = provisioning.get(subject);
  if (current) return await current;
  if (provisioning.size >= 256)
    throw new HTTPError({
      status: 503,
      message: "auth_unavailable",
    });
  let operation!: Promise<User>;
  operation = (async () => {
    await Promise.resolve();
    try {
      if (!authUrl)
        throw new HTTPError({
          status: 503,
          message: "service_not_configured",
        });
      const response = await fetch(new URL("/auth/oauth2/userinfo", authUrl), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 401)
        throw new HTTPError({
          status: 401,
          message: "invalid_access_token",
        });
      if (!response.ok)
        throw new HTTPError({
          status: 503,
          message: "auth_unavailable",
        });
      const parsed = ssoProfileSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.sub !== subject)
        throw new HTTPError({
          status: 401,
          message: "invalid_subject",
        });
      if (parsed.data.status !== "active")
        throw new HTTPError({
          status: 403,
          message: "inactive_user",
        });
      const profile = formatServiceProfile(parsed.data);
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
    } finally {
      if (provisioning.get(subject) === operation) provisioning.delete(subject);
    }
  })();
  provisioning.set(subject, operation);
  return await operation;
}
