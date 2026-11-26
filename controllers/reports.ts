import type { ApiContext } from "@/types/auth";
import { getQueryValues, readRequestBody } from "@/utils/request";
import { paginationSchema, uuidSchema } from "@/schemas/common";
import {
  createReportSchema,
  listReportsSchema,
  resolveReportSchema,
} from "@/schemas/reports";
import {
  rawCreateReport as createReportServices,
  rawListMyReports as listMyReportsServices,
  rawListReportsManagement as listReportsServices,
  rawResolveReportManagement as resolveReportServices,
} from "@/models/reports";

export async function actListMyReports(context: ApiContext) {
  const { limit, offset } = paginationSchema.parse(getQueryValues(context.req.raw));
  return context.json(
    await listMyReportsServices(context.get("auth")!, limit, offset),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actCreateReport(context: ApiContext) {
  const report = await createReportServices(
    createReportSchema.parse(await readRequestBody(context.req)),
    context.get("auth")!,
  );
  return context.json(report, {
    status: 201,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actListReports(context: ApiContext) {
  const input = listReportsSchema.parse(getQueryValues(context.req.raw));
  return context.json(
    await listReportsServices(
      context.get("auth")!,
      input.status,
      input.limit,
      input.offset,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actResolveReport(context: ApiContext) {
  return context.json(
    await resolveReportServices(
      uuidSchema.parse(context.req.param("id")!),
      resolveReportSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
