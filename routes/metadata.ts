import { Hono } from "hono";
import { actResourceMetadata } from "@/controllers/metadata";

export const metadataRoutes = new Hono();

metadataRoutes.get("/oauth-protected-resource", actResourceMetadata);
