import type { ApiEnv } from "@/types/auth";
import type { MiddlewareHandler } from "hono";
import type { ApiContext } from "@/types/auth";
import { HTTPError } from "nitro/h3";
import { verifyMachineRequest } from "@/lib/auth/machine";
import { serviceAuthFailure } from "@/lib/auth/verification";
export function requireTaskPolicyEvent(): MiddlewareHandler<ApiEnv> {
  return async (context: ApiContext, next) => {
    try {
      await verifyMachineRequest(context.req.raw, "task:resource:policy");
    } catch (error) {
      return serviceAuthFailure(error);
    }
    const body = await context.req.text();
    if (Buffer.byteLength(body) > 1500000)
      throw new HTTPError({
        status: 413,
        message: "policy_snapshot_too_large",
      });
    context.set("taskPolicyBody", body);
    return await next();
  };
}
