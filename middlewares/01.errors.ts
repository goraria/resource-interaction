import { onError } from "nitro/h3";
import { ZodError } from "zod";
import { ServiceError } from "@/lib/errors";
import { createServiceErrorHandler, serviceErrorJson } from "@/modules/principle/service-errors";

export const handleServiceError = createServiceErrorHandler("[resource-interaction-error]", (error) => {
  if (error instanceof ZodError)
    return serviceErrorJson({ error: "validation_error", issues: error.issues }, 400);
  if (error instanceof ServiceError)
    return serviceErrorJson({ error: error.message }, error.status);
});

export default onError(handleServiceError);
