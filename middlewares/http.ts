import { createServiceHttp, type ServiceHttpOptions } from "@/modules/principle/http";
import { handleServiceError } from "@/middlewares/01.errors";
import { rateLimitStore } from "@/models/rate-limit";

export function serviceHttp(options: ServiceHttpOptions) {
  return createServiceHttp(options, rateLimitStore, handleServiceError);
}
