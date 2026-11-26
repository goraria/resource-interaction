import { definePlugin } from "nitro";
import { registerVercelTelemetry } from "@gorth-com/principle/configs/vercel";
import { vercelTelemetryEnabled } from "@/utils/environment";

export default definePlugin(() => {
  registerVercelTelemetry("resource-interaction", vercelTelemetryEnabled);
});
