import { getApplicationOrigin } from "@/modules/structure/sso-directory";
import { ServiceError } from "@/lib/errors";
import { isProduction } from "@/utils/environment";
export async function assertReaderAccess(
  reference: { resourceType: string; resourceId: string },
  token: string,
  action: "read" | "comment" | "share" | "interact" = "read",
) {
  if (!token)
    throw new ServiceError("reader_policy_unavailable", 503);
  let base: URL;
  try {
    base = new URL(await getApplicationOrigin("reader"));
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== "/" ||
      (base.protocol !== "https:" &&
        (isProduction ||
          base.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)))
    )
      throw new Error();
  } catch {
    throw new ServiceError("reader_policy_unavailable", 503);
  }
  if (
    ![
      "story",
      "chapter",
      "manga",
      "manhwa",
      "manhua",
      "comic",
      "webtoon",
      "novel",
      "web_novel",
      "light_novel",
      "one_shot",
    ].includes(reference.resourceType)
  )
    throw new ServiceError("reader_resource_forbidden", 403);
  let response: Response;
  try {
    response = await fetch(new URL("/reader/access", base), {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ ...reference, action }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ServiceError("reader_policy_unavailable", 503);
  }
  if (!response.ok)
    throw new ServiceError(
      response.status >= 500
        ? "reader_policy_unavailable"
        : "reader_resource_forbidden",
      response.status >= 500 ? 503 : 403,
    );
  const result = (await response.json()) as { allowed?: boolean };
  if (result.allowed !== true)
    throw new ServiceError("reader_resource_forbidden", 403);
}
