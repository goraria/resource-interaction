import { Hono } from "hono";
import { defineHandler } from "nitro";
import { routeNotFound } from "@/app/error";
import { metadataRoutes } from "@/routes/metadata";
import { sharedRoutes } from "@/routes/shared";
import { resourceRoutes } from "@/routes/resource";

export const router = new Hono();
router.onError((error) => { throw error });
router.notFound((context) => routeNotFound(context.req.raw));
router.route("/.well-known", metadataRoutes);
router.route("/", sharedRoutes);
router.route("/resource", resourceRoutes);

export default defineHandler((event) => router.fetch(event.req));
