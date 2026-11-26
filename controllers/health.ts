import type { ApiContext } from "@/types/auth";

export function actHealth(context: ApiContext) {
  return context.json(
    { status: "ok", service: "resource-interaction" },
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
