import type { Event } from "@/utils/interface";

export function actGetCurrentUser(context: Event) {
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
