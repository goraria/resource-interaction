import type { Event } from "@/utils/interface";

const service = "resource-interaction";

export function actHealth(context: Event) {
  return context.json({
    status: "ok",
    service,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

export function actStatus(context: Event) {
  return context.json({ status: "ok", service });
}
