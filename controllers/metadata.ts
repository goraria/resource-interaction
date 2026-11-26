import type { ApiContext } from "@/types/auth";
import { resourceReadScopes, resourceWriteScopes } from "@/lib/constants";
import { authUrl } from "@/utils/environment";
import { getServiceOrigin } from "@/utils/sso-directory";

export async function actResourceMetadata(context: ApiContext) {
  if (!authUrl) {
    return context.json(
      { error: "resource_metadata_not_configured" },
      {
        status: 503,
        headers: { "content-type": "application/json; charset=UTF-8" },
      },
    );
  }
  return context.json(
    {
      resource: await getServiceOrigin("resource"),
      authorization_servers: [
        new URL("/auth", authUrl).toString().replace(/\/+$/, ""),
      ],
      scopes_supported: [
        ...Object.values(resourceReadScopes),
        ...Object.values(resourceWriteScopes),
      ],
      bearer_methods_supported: ["header"],
    },
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
