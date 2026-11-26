import { HTTPError } from "nitro/h3";
import { Hono } from "hono";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import {
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "@gorth-com/principle/cores/jose";
vi.mock("@/utils/sso-directory", () => ({
  getServiceClientApplication: async (_service: string, _audience: string, clientId: string) =>
    localClients.find(([id]) => id === clientId)?.[1] ??
    (["gorth-video-streaming-platform", "video-production-v2"].includes(clientId)
      ? "video"
      : undefined),
  getServiceOrigin: async (key: string) => {
    const origins: Record<string, string> = {
      resource: "https://resource.example",
    };
    if (!origins[key]) throw new Error("Unregistered fixture service");
    return origins[key];
  },
  getApplicationOrigin: async (key: string) => {
    const origins: Record<string, string> = {
      resource: "https://resource.example",
    };
    if (!origins[key]) throw new Error("Unregistered fixture application");
    return origins[key];
  },
}));
vi.mock("@/utils/environment", () => ({
  nodeEnv: "test",
  serviceUrl: "https://resource.example",
  authUrl: "https://sso.example",
}));
vi.mock("@/models/users", () => ({
  rawGetServiceUser: vi.fn(async (subject: string) => ({
    id: "local-user",
    externalUserId: subject,
  })),
}));
import {
  serviceAuthFailure,
  verifyServiceRequest,
} from "@/lib/auth/verification";
import { requireAuth } from "@/middlewares/auth";
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let jwk: Awaited<ReturnType<typeof exportJWK>>;
beforeAll(async () => {
  pair = await generateKeyPair("ES256");
  jwk = {
    ...(await exportJWK(pair.publicKey)),
    kid: "native-service",
    alg: "ES256",
  };
});
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    // Fail the test if authentication silently makes a UserInfo/introspection/discovery hop.
    if (url !== "https://sso.example/auth/jwks")
      throw new Error("Unexpected upstream auth request");
    return Response.json({ keys: [jwk] });
  });
});
async function token(
  overrides: Record<string, unknown> = {},
  options: {
    issuer?: string;
    audience?: string;
    typ?: string;
    age?: number;
    lifetime?: number;
  } = {},
) {
  const now = Math.floor(Date.now() / 1000) - (options.age ?? 0);
  return await new SignJWT({
    sub: "sso-sub",
    sid: "sso-session",
    client_id: "gorth-video-streaming-platform",
    scope: "openid video:read video:write",
    ...overrides,
  })
    .setProtectedHeader({
      alg: "ES256",
      kid: "native-service",
      typ: options.typ ?? "at+jwt",
    })
    .setIssuer(options.issuer ?? "https://sso.example/auth")
    .setAudience(options.audience ?? "https://resource.example")
    .setIssuedAt(now)
    .setExpirationTime(now + (options.lifetime ?? 600))
    .sign(pair.privateKey);
}
function request(value: string, scheme = "Bearer") {
  return new Request("https://resource.example/resource", {
    headers: { authorization: scheme + " " + value },
  });
}
async function denied(value: string, status = 401) {
  try {
    await verifyServiceRequest(request(value), "write");
    throw new Error("Unexpected authorization success");
  } catch (error) {
    expect(serviceAuthFailure(error).status).toBe(status);
  }
}
it("uses native JWT verification without online session/profile checks; JWKS stays cached", async () => {
  const value = await token();
  const before = vi.mocked(globalThis.fetch).mock.calls.length;
  const first = await verifyServiceRequest(request(value), "write");
  const warm = vi.mocked(globalThis.fetch).mock.calls.length;
  expect(first.subject).toBe("sso-sub");
  expect(first.application).toBe("video");
  expect(warm - before).toBeLessThanOrEqual(1);
  await verifyServiceRequest(request(value), "read");
  expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(warm);
  expect(
    (await verifyServiceRequest(request(value, "bearer"), "read")).subject,
  ).toBe("sso-sub");
});
const localClients = [
  ["gorth-interactive-messaging-portal-local", "chat"],
  ["gorth-video-streaming-platform-local", "video"],
  ["gorth-content-reader-platform-local", "reader"],
  ["gorth-social-networking-portal-local", "social"],
  ["gorth-task-productivity-suite-local", "task"],
  ["gorth-online-marketplace-solution-local", "marketplace"],
] as const;
it.each(localClients)(
  "accepts registered local client %s with its own native verified scope",
  async (clientId, application) => {
    const value = await token({
      client_id: clientId,
      scope: application + ":write",
    });
    expect(await verifyServiceRequest(request(value), "write")).toMatchObject({
      clientId,
      application,
      subject: "sso-sub",
    });
  },
);
it.each(localClients)(
  "cannot borrow a foreign scope with local client %s",
  async (clientId, application) => {
    await denied(
      await token({
        client_id: clientId,
        scope: (application === "video" ? "chat" : "video") + ":write",
      }),
      403,
    );
  },
);
it("does not trust an arbitrary client that only resembles a local client ID", async () => {
  await denied(
    await token({ client_id: "gorth-video-streaming-platform-local-attacker" }),
    403,
  );
});
it("rejects wrong issuer/audience, expired tokens, ID tokens and opaque credentials", async () => {
  await denied(await token({}, { issuer: "https://other.example/auth" }));
  await denied(await token({}, { audience: "https://other.example" }));
  await denied(await token({}, { age: 601 }));
  await denied(await token({}, { typ: "JWT" }));
  await denied("opaque-token");
});
it("rejects a longer-lived token and tokens without a verified subject", async () => {
  await denied(await token({}, { lifetime: 601 }));
  await denied(await token({ sub: undefined }));
  await denied(await token({ sub: "" }));
  await denied(await token({ sub: 123 }));
  await denied(await token({ sid: 123 }));
});
it("SDK enforces scopes; signed client mapping cannot borrow another application's scope", async () => {
  await denied(await token({ scope: "openid video:read" }), 403);
  await denied(await token({ scope: "openid chat:write" }), 403);
  await denied(await token({ client_id: "unknown-client" }), 403);
  await denied(await token({ client_id: "toString" }), 403);
  await denied(await token({ status: "suspended" }), 403);
});
it("rejects signature tampering and bearer use of DPoP-bound credentials", async () => {
  const stranger = await generateKeyPair("ES256");
  const now = Math.floor(Date.now() / 1000);
  const value = await new SignJWT({
    sub: "sso-sub",
    scope: "video:write",
    client_id: "gorth-video-streaming-platform",
  })
    .setProtectedHeader({ alg: "ES256", kid: "native-service", typ: "at+jwt" })
    .setIssuer("https://sso.example/auth")
    .setAudience("https://resource.example")
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(stranger.privateKey);
  await denied(value);
  await denied(await token({ cnf: { jkt: "unverified-proof" } }));
});
it("middleware preserves downstream errors rather than turning them into 401", async () => {
  const app = new Hono();
  app.post("/protected", requireAuth("write"), () => {
    throw new HTTPError({
      status: 409,
      message: "",
    });
  });
  app.onError((error) => {
    return error instanceof HTTPError
      ? new Response(error.message, {
          status: error.status,
          headers: error.headers,
        })
      : Response.json(
          {},
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
  });
  const value = await token();
  expect(
    (
      await app.request("/protected", {
        method: "POST",
        headers: { authorization: "Bearer " + value },
      })
    ).status,
  ).toBe(409);
});
it("maps infrastructure failures to unavailable instead of logging a user out", () => {
  const response = serviceAuthFailure(
    new Error("private-key-or-provider-details"),
  );
  expect(response.status).toBe(503);
});
it("uses SDK kid rotation handling without forced reloads on warm tokens", async () => {
  const next = await generateKeyPair("ES256");
  const nextJwk = {
    ...(await exportJWK(next.publicKey)),
    kid: "native-service-next",
    alg: "ES256",
  };
  vi.mocked(globalThis.fetch).mockResolvedValue(
    Response.json({ keys: [jwk, nextJwk] }),
  );
  const now = Math.floor(Date.now() / 1000);
  const rotated = await new SignJWT({
    sub: "sso-sub",
    sid: "sso-session",
    client_id: "gorth-video-streaming-platform",
    scope: "video:write",
  })
    .setProtectedHeader({
      alg: "ES256",
      kid: "native-service-next",
      typ: "at+jwt",
    })
    .setIssuer("https://sso.example/auth")
    .setAudience("https://resource.example")
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .sign(next.privateKey);
  expect((await verifyServiceRequest(request(rotated), "write")).subject).toBe(
    "sso-sub",
  );
  const fetched = vi.mocked(globalThis.fetch).mock.calls.length;
  await verifyServiceRequest(request(rotated), "write");
  expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetched);
});

it("returns the complete handler response after successful bearer authentication", async () => {
  const app = new Hono();
  app.get("/protected-success", requireAuth("write"), () =>
    Response.json({ accepted: true }, { status: 202 }),
  );
  const response = await app.request("/protected-success", {
    headers: { authorization: "Bearer " + (await token()) },
  });
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ accepted: true });
});

it("accepts a configured client only with that namespace's verified scope", async () => {
  const value = await token({ client_id: "video-production-v2" });
  expect(await verifyServiceRequest(request(value), "write")).toMatchObject({
    clientId: "video-production-v2",
    application: "video",
  });
  await denied(
    await token({ client_id: "video-production-v2", scope: "chat:write" }),
    403,
  );
  await denied(await token({ client_id: "video-production-v2-foreign" }), 403);
});
