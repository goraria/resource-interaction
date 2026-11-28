import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { APIError } from "better-auth/api";
import {
  isInsufficientScopeError,
  parseAccessTokenAuthorization,
  requestToResourceInput,
  verifyAccessTokenRequest,
  type VerifyAccessTokenOptions,
} from "better-auth/oauth2";

export function readBearerResourceRequest(request: Request) {
  const input = requestToResourceInput(request);
  const authorization = parseAccessTokenAuthorization(
    input.authorizationHeader,
  );
  if (
    authorization?.scheme !== "Bearer" ||
    !/^Bearer [^\s]+$/i.test(input.authorizationHeader ?? "")
  )
    throw new APIError("UNAUTHORIZED", {
      ...(input.authorizationHeader ? { error: "invalid_token" } : {}),
    });
  return { ...input, authorizationHeader: "Bearer " + authorization.token };
}

export function verifyBearerResourceRequest(
  input: ReturnType<typeof readBearerResourceRequest>,
  options: VerifyAccessTokenOptions,
) {
  return verifyAccessTokenRequest(input, options);
}

const resourceClient = oauthProviderResourceClient().getActions();

export async function protectedResourceMetadata(
  resource: string,
  issuer: string,
  scopes?: string[],
) {
  return resourceClient.getProtectedResourceMetadata(
    {
      resource,
      authorization_servers: [issuer],
      bearer_methods_supported: ["header"],
      dpop_signing_alg_values_supported: undefined,
      ...(scopes ? { scopes_supported: scopes } : {}),
    },
    { externalScopes: scopes },
  );
}

export async function withResourceServerChallenge(
  response: Response,
  failure: unknown,
  request: Request,
  audience: () => Promise<string>,
) {
  const scopeFailure =
    response.status === 403 && isInsufficientScopeError(failure);
  if (response.status !== 401 && !scopeFailure) return response;

  let resource: string;
  try {
    resource = await audience();
  } catch {
    return response;
  }

  const presented = parseAccessTokenAuthorization(
    requestToResourceInput(request).authorizationHeader,
  );
  const error = scopeFailure
    ? failure
    : new APIError("UNAUTHORIZED", {
        ...(presented ? { error: "invalid_token" } : {}),
      });
  // These resource servers advertise Bearer even when a client presents another scheme.
  const challenge = createResourceServerChallenge(error, resource);
  if (!challenge) return response;
  const headers = new Headers(response.headers);
  const challengeHeaders = new Headers(challenge.headers);
  const authenticate = challengeHeaders.get("WWW-Authenticate");
  if (authenticate) headers.set("WWW-Authenticate", authenticate);
  const exposed = headers.get("Access-Control-Expose-Headers");
  if (
    !exposed
      ?.toLowerCase()
      .split(/\s*,\s*/)
      .includes("www-authenticate")
  ) {
    headers.set(
      "Access-Control-Expose-Headers",
      exposed ? exposed + ", WWW-Authenticate" : "WWW-Authenticate",
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createResourceServerProtocol(
  authUrl: string | undefined,
  audience: () => Promise<string>,
  scopes?: string[],
) {
  return {
    challenge(response: Response, failure: unknown, request: Request) {
      return withResourceServerChallenge(response, failure, request, audience);
    },
    async metadata() {
      if (!authUrl)
        return Response.json(
          { error: "resource_metadata_not_configured" },
          { status: 503 },
        );
      return Response.json(
        await protectedResourceMetadata(
          await audience(),
          new URL("/auth", authUrl).href,
          scopes,
        ),
      );
    },
  };
}
