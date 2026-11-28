import { HTTPError } from "nitro/h3";
import {
  readBearerResourceRequest,
  verifyBearerResourceRequest,
} from "./resource-server";
import { requireServiceMachineBinding } from "./sso-directory";

export async function verifyServiceMachineGrant(
  request: Request,
  service: string,
  config: { jwksUrl: string; issuer: string; audience: string },
  scopes: readonly string[],
  errors: { browser?: string; grant?: string } = {},
) {
  if (
    ["cookie", "origin", "sec-fetch-site"].some((header) =>
      request.headers.has(header),
    )
  )
    throw new HTTPError({ status: 403, message: errors.browser });

  const claims = await verifyBearerResourceRequest(
    readBearerResourceRequest(request),
    {
      jwksUrl: config.jwksUrl,
      requiredScopes: [...scopes],
      isScopeSatisfied: (_required, granted) =>
        scopes.some((scope) => granted.has(scope)),
      verifyOptions: {
        issuer: config.issuer,
        audience: config.audience,
        typ: "at+jwt",
        algorithms: ["RS256", "ES256", "EdDSA"],
        requiredClaims: ["iss", "aud", "sub", "client_id", "iat", "exp"],
        maxTokenAge: 600,
      },
    },
  );
  const granted =
    typeof claims.scope === "string" ? claims.scope.split(" ") : [];
  const matching = scopes.filter((scope) => granted.includes(scope));
  if (
    matching.length !== 1 ||
    typeof claims.client_id !== "string" ||
    !claims.client_id ||
    claims.sub !== claims.client_id ||
    claims.sid !== undefined ||
    typeof claims.iat !== "number" ||
    typeof claims.exp !== "number" ||
    claims.exp <= claims.iat ||
    claims.exp - claims.iat > 600 ||
    (claims.status !== undefined && claims.status !== "active")
  )
    throw new HTTPError({ status: 403, message: errors.grant });
  await requireServiceMachineBinding(
    service,
    config.audience,
    claims.client_id,
  );
  return { claims, clientId: claims.client_id, scope: matching[0]! };
}
