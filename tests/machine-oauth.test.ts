import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { HTTPError } from "nitro/h3";
import {
  generateKeyPair,
  exportJWK,
  SignJWT,
} from "@gorth-com/principle/cores/jose";
vi.mock("@/utils/sso-directory", () => ({
  requireServiceMachineBinding: async (_service: string, _audience: string, id: string) => {
    if (!["existing-confidential-client", "rotated-existing-client"].includes(id))
      throw new HTTPError({ status: 403 });
  },
  getServiceOrigin: async (key: string) => {
    const origins: Record<string, string> = {
      resource: "https://machine-service.example.test",
    };
    if (!origins[key]) throw new Error("Unregistered fixture service");
    return origins[key];
  },
  getApplicationOrigin: async (key: string) => {
    const origins: Record<string, string> = {
      resource: "https://machine-service.example.test",
    };
    if (!origins[key]) throw new Error("Unregistered fixture application");
    return origins[key];
  },
}));
vi.mock("@/utils/environment", () => ({
  oauthClientBindings: undefined,
  serviceUrl: "https://machine-service.example.test",
  authUrl: "https://machine-auth.example.test",
  isProduction: true,
}));
import { verifyMachineRequest } from "@/lib/auth/machine";
let pair: Awaited<ReturnType<typeof generateKeyPair>>;
let key: Awaited<ReturnType<typeof exportJWK>>;
beforeAll(async () => {
  pair = await generateKeyPair("ES256");
  key = {
    ...(await exportJWK(pair.publicKey)),
    kid: "machine-verification",
    alg: "ES256",
  };
});
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== "https://machine-auth.example.test/auth/jwks")
      throw new Error("Unexpected auth hop");
    return Response.json({ keys: [key] });
  });
});
async function token(override: Record<string, unknown> = {}, typ = "at+jwt") {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    iss: "https://machine-auth.example.test/auth",
    aud: "https://machine-service.example.test",
    sub: "existing-confidential-client",
    client_id: "existing-confidential-client",
    scope: "task:resource:policy",
    iat: now,
    exp: now + 120,
    ...override,
  })
    .setProtectedHeader({ alg: "ES256", kid: "machine-verification", typ })
    .sign(pair.privateKey);
}
function request(
  bearer?: string,
  headers: Record<string, string | undefined> = {},
) {
  const wire = new Headers();
  for (const [key, value] of Object.entries(headers))
    if (value !== undefined) wire.set(key, value);
  if (bearer) wire.set("Authorization", `Bearer ${bearer}`);
  return new Request("https://machine-service.example.test/internal", {
    headers: wire,
  });
}

it("accepts an existing confidential client with the exact machine scope", async () => {
  expect(
    await verifyMachineRequest(request(await token()), "task:resource:policy"),
  ).toMatchObject({ client_id: "existing-confidential-client" });
});
it("does not require copying the existing client ID into receiver env", async () => {
  expect(
    await verifyMachineRequest(
      request(
        await token({
          client_id: "rotated-existing-client",
          sub: "rotated-existing-client",
        }),
      ),
      "task:resource:policy",
    ),
  ).toMatchObject({ client_id: "rotated-existing-client" });
});
it.each([
  { sub: "normal-user", sid: "user-session" },
  { scope: "task:read" },
  { exp: 1 },
  { aud: "https://foreign.example.test" },
  { iss: "https://foreign.example.test/auth" },
  { iat: 9999999999, exp: 99999999999 },
  { cnf: { jkt: "dpop-bound" } },
])("rejects user/wrong-scope/expired/misbound grants %j", async (override) => {
  await expect(
    verifyMachineRequest(
      request(await token(override)),
      "task:resource:policy",
    ),
  ).rejects.toBeTruthy();
});
it("rejects missing tokens, ID tokens and tampered signatures", async () => {
  await expect(
    verifyMachineRequest(request(), "task:resource:policy"),
  ).rejects.toBeTruthy();
  await expect(
    verifyMachineRequest(
      request(await token({}, "JWT")),
      "task:resource:policy",
    ),
  ).rejects.toBeTruthy();
  const parts = (await token()).split(".");
  parts[2] = "A".repeat(parts[2]!.length);
  await expect(
    verifyMachineRequest(request(parts.join(".")), "task:resource:policy"),
  ).rejects.toBeTruthy();
});
it.each([
  { Cookie: "session=user" },
  { Origin: "https://machine-service.example.test" },
  { "Sec-Fetch-Site": "same-origin" },
])(
  "rejects browser request headers even with a valid machine token %j",
  async (headers) => {
    await expect(
      verifyMachineRequest(
        request(await token(), headers),
        "task:resource:policy",
      ),
    ).rejects.toBeTruthy();
  },
);
