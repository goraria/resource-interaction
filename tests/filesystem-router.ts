import { Hono } from "hono"
import { resourceRoutes } from "@/routes/resource"

export function filesystemRouter() {
  return new Hono().route("/resource", resourceRoutes)
}
