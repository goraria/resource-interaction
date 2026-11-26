import { getServiceOrigin, requireServiceMachineBinding } from "@/utils/sso-directory";
import { HTTPError } from "nitro/h3";
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from "better-auth/oauth2";
import { authUrl, isProduction } from "@/utils/environment";

/** Verify the machine grant and the current registry binding for this audience. */
export async function verifyMachineRequest(request: Request, scope: string) {
  let issuer: string, jwksUrl: string, audience: string;
  try {
    for (const raw of [authUrl]) {
      const url = new URL(raw!);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== "/" ||
        (url.protocol !== "https:" &&
          (isProduction ||
            url.protocol !== "http:" ||
            !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
      )
        throw new Error();
    }
    issuer = new URL("/auth", authUrl).href.replace(/\/$/, "");
    jwksUrl = new URL("/auth/jwks", authUrl).href;
    audience = new URL(await getServiceOrigin("resource")).origin;
  } catch {
    throw new HTTPError({
      status: 503,
      message: "machine_oauth_not_configured",
    });
  }
  if (
    ["cookie", "origin", "sec-fetch-site"].some((header) =>
      request.headers.has(header),
    )
  )
    throw new HTTPError({ status: 403, message: "machine_request_required" });
  const input = requestToResourceInput(request);
  if (
    !input.authorizationHeader ||
    !/^Bearer [^\s]+$/i.test(input.authorizationHeader)
  )
    throw new HTTPError({ status: 401, message: "missing_access_token" });
  input.authorizationHeader = "Bearer " + input.authorizationHeader.slice(7);
  const claims = await verifyAccessTokenRequest(input, {
    jwksUrl,
    requiredScopes: [scope],
    verifyOptions: {
      issuer,
      audience,
      typ: "at+jwt",
      algorithms: ["RS256", "ES256", "EdDSA"],
      requiredClaims: ["iss", "aud", "sub", "client_id", "iat", "exp"],
      maxTokenAge: 600,
    },
  });
  if (
    typeof claims.client_id !== "string" ||
    !claims.client_id ||
    claims.sub !== claims.client_id ||
    claims.sid !== undefined ||
    typeof claims.scope !== "string" ||
    !claims.scope.split(" ").includes(scope) ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > 600 ||
    (claims.status !== undefined && claims.status !== "active")
  )
    throw new HTTPError({ status: 403, message: "forbidden_machine_grant" });
  await requireServiceMachineBinding("resource", audience, claims.client_id);
  return claims;
}
