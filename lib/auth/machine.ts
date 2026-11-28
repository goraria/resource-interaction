import { getServiceOrigin } from "@/modules/structure/sso-directory";
import { HTTPError } from "nitro/h3";
import { verifyServiceMachineGrant } from "@/modules/structure/machine-verification";
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
  const { claims } = await verifyServiceMachineGrant(
    request,
    "resource",
    { jwksUrl, issuer, audience },
    [scope],
    { browser: "machine_request_required", grant: "forbidden_machine_grant" },
  );
  return claims;
}
