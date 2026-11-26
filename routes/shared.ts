import { Hono } from "hono";
import { actHealth } from "@/controllers/health";

export const sharedRoutes = new Hono();

sharedRoutes.get("/health", actHealth);
