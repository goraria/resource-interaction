import type { Binding, Event, AuthContext, ServiceAccess } from "@/utils/interface";
import type { MiddlewareHandler } from "hono";

import {
  serviceAuthFailure,
  verifyServiceRequest,
} from "@/lib/auth/verification";
import { rawGetServiceUser } from "@/models/users";

export function requireAuth(access: ServiceAccess): MiddlewareHandler<Binding> {
  return createHonoRequestGuard<AuthContext>({
    async verify(request) {
      const verified = await verifyServiceRequest(request, access);
      const user = await rawGetServiceUser(
        verified.subject,
        request.headers.get("authorization")!.slice(7),
      );
      return {
        application: verified.application,
        clientId: verified.clientId,
        scopes: verified.scopes,
        sessionId: verified.sessionId,
        user,
      };
    },
    failure: serviceAuthFailure,
    assign(event, auth) {
      event.set("auth", auth);
    },
  });
}

function createHonoRequestGuard<Auth>(options: {
  verify: (request: Request) => Promise<Auth>
  failure: (error: unknown) => Response
  assign: (context: Event, identity: Auth) => void
}): MiddlewareHandler<Binding> {
  return async (context, next) => {
    let identity: Auth
    try {
      identity = await options.verify(context.req.raw)
    } catch (error) {
      return options.failure(error)
    }
    options.assign(context, identity)
    await next()
  }
}
