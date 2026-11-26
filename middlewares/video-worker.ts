import type { ApiEnv } from "@/types/auth";
import type { MiddlewareHandler } from "hono";
import { verifyMachineRequest } from "@/lib/auth/machine";
import { serviceAuthFailure } from "@/lib/auth/verification";
export function requireVideoWorker(): MiddlewareHandler<ApiEnv> {
  return async (e, next) => {
    try {
      await verifyMachineRequest(e.req.raw, "video:resource:read");
    } catch (error) {
      return serviceAuthFailure(error);
    }
    return next();
  };
}
