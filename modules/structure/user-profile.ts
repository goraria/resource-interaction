import { HTTPError } from "nitro/h3";
import { z } from "zod";


/** Business identity data, never an alternative token verifier. */
export const ssoProfileSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().min(1).max(255),
  name: z.string().nullable().optional(),
  preferred_username: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  status: z.enum(["active", "inactive", "suspended", "deleted"]),
});
export type SsoProfile = z.infer<typeof ssoProfileSchema>;

const profileMaxAgeMs = 600_000;

export function isServiceProfileFresh(lastSeenAt?: Date | null) {
  const now = Date.now();
  const checkedAt = lastSeenAt?.getTime() ?? 0;
  return checkedAt <= now && checkedAt > now - profileMaxAgeMs;
}

// Bound concurrent profile fetches per process. The model owns the database upsert.
export function createProfileProvisioner<User>() {
  const pending = new Map<string, Promise<User>>();
  return async (
    subject: string,
    provision: () => Promise<User>,
  ): Promise<User> => {
    const current = pending.get(subject);
    if (current) return current;
    if (pending.size >= 256)
      throw new HTTPError({ status: 503, message: "auth_unavailable" });

    const operation = Promise.resolve().then(provision);
    pending.set(subject, operation);
    try {
      return await operation;
    } finally {
      pending.delete(subject);
    }
  };
}

export async function fetchServiceProfile(
  authUrl: string | undefined,
  subject: string,
  accessToken: string,
) {
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
  return parsed.data;
}
