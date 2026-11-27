import { Hono } from "hono";
import { actHealth, actStatus } from "@/controllers/health";

export const sharedRoutes = new Hono();

sharedRoutes.get("/health", actHealth);
sharedRoutes.get("/", actStatus);
