import type { Binding, Event } from "@/utils/interface";
import type { MiddlewareHandler } from "hono";

import { HTTPError } from "nitro/h3";
import { verifyMachineRequest } from "@/lib/auth/machine";
import { serviceAuthFailure } from "@/lib/auth/verification";
export function requireTaskPolicyEvent(): MiddlewareHandler<Binding> {
  return async (context: Event, next) => {
    try {
      await verifyMachineRequest(context.req.raw, "task:resource:policy");
    } catch (error) {
      return serviceAuthFailure(error, context.req.raw);
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
