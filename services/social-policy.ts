import { getApplicationOrigin } from "@/utils/sso-directory";
import { ServiceError } from "@/lib/errors";
import { isProduction } from "@/utils/environment";
export async function assertSocialAccess(
  reference: { resourceType: string; resourceId: string },
  token: string,
  action: "read" | "comment" | "share" | "interact" = "read",
  subjects?: string[],
) {
  if (!token)
    throw new ServiceError("social_policy_unavailable", 503);
  let origin: URL;
  try {
    origin = new URL(await getApplicationOrigin("social"));
    if (
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== "/" ||
      (origin.protocol !== "https:" &&
        (isProduction ||
          origin.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
    )
      throw new Error();
  } catch {
    throw new ServiceError("social_policy_unavailable", 503);
  }
  if (!["post", "tweet", "story"].includes(reference.resourceType))
    throw new ServiceError("social_resource_forbidden", 403);
  let response: Response;
  try {
    response = await fetch(new URL("/social/access", origin), {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType:
          reference.resourceType === "tweet" ? "post" : reference.resourceType,
        resourceId: reference.resourceId,
        action,
        ...(subjects ? { subjects } : {}),
      }),
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
  } catch {
    throw new ServiceError("social_policy_unavailable", 503);
  }
  if (!response.ok)
    throw new ServiceError(
      response.status >= 500
        ? "social_policy_unavailable"
        : "social_resource_forbidden",
      response.status >= 500 ? 503 : 403,
    );
  const result = (await response.json()) as {
    allowed?: boolean;
    deniedSubjects?: unknown;
  };
  if (result.allowed !== true)
    throw new ServiceError("social_resource_forbidden", 403);
  if (
    subjects &&
    (!Array.isArray(result.deniedSubjects) ||
      !result.deniedSubjects.every((s) => typeof s === "string"))
  )
    throw new ServiceError("social_policy_unavailable", 503);
  return { deniedSubjects: (result.deniedSubjects ?? []) as string[] };
}
