import type { ApiContext } from "@/types/auth";

export function actGetCurrentUser(context: ApiContext) {
  const auth = context.get("auth")!;
  return context.json(
    {
      user: auth.user,
      application: auth.application,
      clientId: auth.clientId,
      scopes: auth.scopes,
    },
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
