import { createNitroErrorHandler } from "@gorth-com/principle/configs/nitro";
import { defineErrorHandler } from "nitro";
import { HTTPError } from "nitro/h3";

export function createServiceRouteFallback(label: string, includeMethod = true) {
  const routeNotFound = (request: Request) => {
    const { pathname } = new URL(request.url);
    return includeMethod
      ? serviceErrorJson(
          { error: label, message: `Route ${request.method} ${pathname} not found` },
          404,
        )
      : Response.json({ error: label, path: pathname }, { status: 404 });
  };

  return {
    routeNotFound,
    handler: defineErrorHandler((error, event) => {
      if (error.status === 404 || error.status === 405) return routeNotFound(event.req);
    }),
  };
}

export function serviceErrorJson(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}

export function createServiceErrorHandler(
  label: string,
  project?: (error: unknown) => Response | undefined,
  fallback = { error: "internal_server_error" } as object,
  logBeforeProject = false,
) {
  return createNitroErrorHandler({
    project(error) {
      if (logBeforeProject) console.error(label, "operation_failed");
      const response = project?.(error);
      if (response) return response;
      if (error instanceof HTTPError)
        return new Response(error.message, {
          status: error.status,
          headers: error.headers,
        });
      if (!logBeforeProject) console.error(label, "operation_failed");
      return serviceErrorJson(fallback, 500);
    },
  });
}
