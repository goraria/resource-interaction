import type { Binding, Event } from "@/utils/interface";
import type { MiddlewareHandler } from "hono";

export function createHonoRequestGuard<Auth>(options: {
  verify: (request: Request) => Promise<Auth>;
  failure: (error: unknown, request: Request) => Response | Promise<Response>;
  assign: (context: Event, identity: Auth) => void;
}): MiddlewareHandler<Binding> {
  return async (context, next) => {
    let identity: Auth;
    try {
      identity = await options.verify(context.req.raw);
    } catch (error) {
      return options.failure(error, context.req.raw);
    }
    options.assign(context, identity);
    await next();
  };
}
