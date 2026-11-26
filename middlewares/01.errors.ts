import { createNitroErrorHandler } from "@gorth-com/principle/configs/nitro";
import { HTTPError, onError } from "nitro/h3";
import { ZodError } from "zod";
import { ServiceError } from "@/lib/errors";

export const handleServiceError = createNitroErrorHandler({
  project(error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "validation_error", issues: error.issues },
        {
          status: 400,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }
    if (error instanceof ServiceError) {
      return Response.json(
        { error: error.message },
        {
          status: error.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }
    if (error instanceof HTTPError) {
      return new Response(error.message, {
        status: error.status,
        headers: error.headers,
      });
    }
    console.error("[resource-interaction-error] operation_failed");
    return Response.json(
      { error: "internal_server_error" },
      {
        status: 500,
        headers: { "content-type": "application/json; charset=UTF-8" },
      },
    );
  },
});

export default onError(handleServiceError);
