import { defineErrorHandler } from "nitro";

export function routeNotFound(request: Request) {
  return Response.json(
      {
        error: "not_found",
        message: `Route ${request.method} ${new URL(request.url).pathname} not found`,
      },
      {
        status: 404,
        headers: { "content-type": "application/json; charset=UTF-8" },
      },
    );
}

export default defineErrorHandler((error, event) => {
  if (error.status === 404 || error.status === 405) return routeNotFound(event.req)
});
