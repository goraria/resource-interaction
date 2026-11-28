import { createServiceRouteFallback } from "@/modules/principle/service-errors";

const fallback = createServiceRouteFallback("not_found");
export const routeNotFound = fallback.routeNotFound;
export default fallback.handler;
