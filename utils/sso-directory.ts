import { z } from "zod";
import { HTTPError } from "nitro/h3";
import { authUrl, isProduction } from "@/utils/environment";

const originSchema = z.string().transform((value, context) => {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(!isProduction && local && url.protocol === "http:")) ||
      (!local && /^(?:\d+\.\d+\.\d+\.\d+|\[)/.test(url.hostname)) ||
      (isProduction && local)) throw new Error();
    return url.origin;
  } catch {
    context.addIssue({ code: "custom", message: "Invalid directory origin" });
    return z.NEVER;
  }
});
const entry = z.object({ origin: originSchema });
const directorySchema = z.object({
  version: z.literal(1), environment: z.enum(["local", "production"]),
  issuer: z.string().url(),
  applications: z.record(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), entry.extend({
    clientIds: z.array(z.string().min(1).max(255)).max(128),
  })),
  services: z.record(z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), entry.extend({
    audience: originSchema,
    clientBindings: z.record(z.string().min(1).max(255), z.string().regex(/^[a-z][a-z0-9-]{0,63}$/)).optional(),
    machineClientIds: z.array(z.string().min(1).max(255)).optional(),
  })),
});
let cached: { until: number; value: z.infer<typeof directorySchema> } | undefined;
let pending: Promise<z.infer<typeof directorySchema>> | undefined;

async function loadDirectory() {
  try {
    if (!authUrl) throw new Error();
    const authority = originSchema.parse(authUrl);
    const environment = isProduction ? "production" : "local";
    const url = new URL("/.well-known/gorth-application", authority);
    url.searchParams.set("environment", environment);
    const response = await fetch(url, {
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json"))
      throw new Error();
    const text = await response.text();
    if (text.length > 131_072) throw new Error();
    const value = directorySchema.parse(JSON.parse(text));
    if (value.environment !== environment || value.issuer !== new URL("/auth", authority).href)
      throw new Error();
    for (const service of Object.values(value.services))
      if (service.origin !== service.audience) throw new Error();
    cached = { until: Date.now() + 30_000, value };
    return value;
  } catch {
    throw new HTTPError({ status: 503, message: "sso_directory_unavailable" });
  }
}
export async function getSsoDirectory() {
  if (cached && cached.until > Date.now()) return cached.value;
  pending ??= loadDirectory().finally(() => { pending = undefined; });
  return pending;
}
export async function getServiceOrigin(key: string) {
  const entry = (await getSsoDirectory()).services[key];
  if (!entry) throw new HTTPError({ status: 503, message: "sso_service_not_registered" });
  return entry.origin;
}
export async function getServiceClientApplication(
  service: string,
  audience: string,
  clientId: string,
) {
  const registration = (await getSsoDirectory()).services[service];
  if (!registration?.clientBindings || registration.audience !== audience)
    throw new HTTPError({ status: 503, message: "sso_service_bindings_unavailable" });
  return Object.hasOwn(registration.clientBindings, clientId)
    ? registration.clientBindings[clientId]
    : undefined;
}

export async function requireServiceMachineBinding(
  service: string,
  audience: string,
  clientId: string,
) {
  const registration = (await getSsoDirectory()).services[service];
  if (!registration?.machineClientIds || registration.audience !== audience)
    throw new HTTPError({ status: 503, message: "sso_service_bindings_unavailable" });
  if (!registration.machineClientIds.includes(clientId))
    throw new HTTPError({ status: 403, message: "unauthorized_oauth_client" });
}
export async function getApplicationOrigin(key: string) {
  const entry = (await getSsoDirectory()).applications[key];
  if (!entry) throw new HTTPError({ status: 503, message: "sso_application_not_registered" });
  return entry.origin;
}
