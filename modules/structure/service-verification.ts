import { HTTPError } from "nitro/h3";
import {
  AuthError,
  authFailure,
  createBearerVerifier,
} from "@gorth-com/structure/modules/auth/server";
import {
  createInsufficientScopeError,
  isInsufficientScopeError,
} from "better-auth/oauth2";
import {
  createResourceServerProtocol,
  readBearerResourceRequest,
} from "./resource-server";
import { getServiceClientApplication, getServiceOrigin } from "./sso-directory";

export function createServiceVerification<Application extends string>(options: {
  service: string;
  authUrl: string | undefined;
  nodeEnv: string | undefined;
  applications: readonly Application[];
  scopeFor: (application: Application, access: "read" | "write") => string;
  metadataScopes?: string[];
  publicUnavailableErrors?: readonly string[];
}) {
  const {
    service,
    authUrl,
    nodeEnv,
    applications,
    scopeFor,
    metadataScopes,
    publicUnavailableErrors = [],
  } = options;
  const protocol = createResourceServerProtocol(
    authUrl,
    () => getServiceOrigin(service),
    metadataScopes,
  );

  async function serviceTokenConfiguration() {
    try {
      if (!authUrl) throw new Error();
      const source = new URL(authUrl);
      const resource = new URL(await getServiceOrigin(service));
      for (const url of [source, resource]) {
        if (
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          url.pathname !== "/" ||
          (url.protocol !== "https:" &&
            !(
              nodeEnv !== "production" &&
              url.protocol === "http:" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
            ))
        )
          throw new Error();
      }
      return {
        issuer: new URL("/auth", source).href.replace(/\/$/, ""),
        jwksUrl: new URL("/auth/jwks", source).href,
        audience: resource.origin,
      };
    } catch {
      throw new HTTPError({
        status: 503,
        message: "service_not_configured",
      });
    }
  }

  /** JWT bearer only. Better Auth owns signature/claims/scopes and JWKS caching/rotation. */
  async function verifyServiceRequest(
    request: Request,
    access: "read" | "write",
  ) {
    readBearerResourceRequest(request);
    const config = await serviceTokenConfiguration();
    const permitted = applications.map((application) =>
      scopeFor(application, access),
    );
    const verify = createBearerVerifier({
      allowLoopbackHttp: nodeEnv !== "production",
      claims: { maxLifetimeSeconds: 600 },
      verification: {
        jwksUrl: config.jwksUrl,
        verifyOptions: {
          issuer: config.issuer,
          audience: config.audience,
          typ: "at+jwt",
          algorithms: ["RS256", "ES256", "EdDSA"],
          requiredClaims: ["iss", "aud", "sub", "iat", "exp"],
          maxTokenAge: 600,
          clockTolerance: 0,
        },
        // The SDK applies the configured scope policy. The client-to-app binding below
        // additionally prevents one app from borrowing another app's scope.
        requiredScopes: permitted,
        isScopeSatisfied: (_required, granted) =>
          permitted.some((scope) => granted.has(scope)),
      },
    });
    const claims = await verify(request);
    if (
      typeof claims.sub !== "string" ||
      !claims.sub ||
      claims.sub.length > 255 ||
      typeof claims.iat !== "number" ||
      typeof claims.exp !== "number" ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > 600 ||
      (claims.sid !== undefined &&
        (typeof claims.sid !== "string" ||
          !claims.sid ||
          claims.sid.length > 255))
    )
      throw new HTTPError({
        status: 401,
        message: "invalid_access_token",
      });
    const clientId = claims.client_id ?? claims.azp;
    if (typeof clientId !== "string")
      throw new HTTPError({
        status: 403,
        message: "unauthorized_oauth_client",
      });
    if (claims.sub === clientId)
      throw new HTTPError({ status: 403, message: "user_identity_required" });
    const registeredApp = await getServiceClientApplication(
      service,
      config.audience,
      clientId,
    );
    const application = applications.find((app) => app === registeredApp);
    if (!application)
      throw new HTTPError({
        status: 403,
        message: "unauthorized_oauth_client",
      });
    const scopes =
      typeof claims.scope === "string" ? claims.scope.split(" ") : [];
    if (!scopes.includes(scopeFor(application, access)))
      throw createInsufficientScopeError([scopeFor(application, access)]);
    if (claims.status !== undefined && claims.status !== "active")
      throw new HTTPError({
        status: 403,
        message: "inactive_user",
      });
    return {
      claims,
      clientId,
      application,
      scopes,
      subject: claims.sub,
      sessionId: typeof claims.sid === "string" ? claims.sid : null,
    };
  }

  function serviceAuthFailure(error: unknown, request: Request) {
    return protocol.challenge(authErrorResponse(error), error, request);
  }

  function authErrorResponse(error: unknown): Response {
    if (error instanceof AuthError) {
      const failure = authFailure(error);
      return Response.json(
        { error: failure.code },
        { status: failure.status, headers: failure.headers },
      );
    }
    if (isInsufficientScopeError(error))
      return Response.json(
        { error: "insufficient_scope", scope: error.body?.scope },
        { status: 403 },
      );
    const status =
      error instanceof HTTPError
        ? error.status
        : error && typeof error === "object" && "statusCode" in error
          ? error.statusCode
          : error &&
              typeof error === "object" &&
              "code" in error &&
              typeof error.code === "string" &&
              /^(ERR_JWT|ERR_JWS|ERR_JOSE|ERR_JWKS_NO_MATCHING_KEY)/.test(
                error.code,
              )
            ? 401
            : 503;
    if (status === 401)
      return Response.json({ error: "invalid_access_token" }, { status: 401 });
    if (status === 403)
      return Response.json({ error: "forbidden" }, { status: 403 });
    if (
      error instanceof HTTPError &&
      status === 503 &&
      publicUnavailableErrors.includes(error.message)
    )
      return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ error: "auth_unavailable" }, { status: 503 });
  }

  return {
    serviceTokenConfiguration,
    verifyServiceRequest,
    serviceAuthFailure,
    serviceResourceMetadata: protocol.metadata,
  };
}
