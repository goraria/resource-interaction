import type { Event } from "@/utils/interface";
import { getQueryValues, readRequestBody } from "@/modules/principle/request";
import {
  counterMutationSchema,
  createResourceSchema,
  listResourcesSchema,
  resolveResourceSchema,
  updateResourceSchema,
  verifiedReferenceSchema,
} from "@/schemas/resources";
import { uuidSchema } from "@/schemas/common";
import {
  rawCreateResource as createResourceServices,
  rawCreateVerifiedReference as createVerifiedReferenceServices,
  rawDeleteResource as deleteResourceServices,
  rawDeleteVerifiedReference as deleteVerifiedReferenceServices,
  rawGetResource as getResourceServices,
  rawListResourceCounters as listResourceCountersServices,
  rawListResources as listResourcesServices,
  rawResolveResource as resolveResourceServices,
  rawListVerifiedReferences as listVerifiedReferencesServices,
  rawUpdateResource as updateResourceServices,
  rawUpdateResourceCounter as updateResourceCounterServices,
} from "@/models/resources";

export async function actListResources(context: Event) {
  return context.json(
    await listResourcesServices(
      listResourcesSchema.parse(getQueryValues(context.req.raw)),
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actGetResource(context: Event) {
  return context.json(
    await getResourceServices(uuidSchema.parse(context.req.param("id")!)),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actResolveResource(context: Event) {
  return context.json(
    await resolveResourceServices(
      resolveResourceSchema.parse(getQueryValues(context.req.raw)),
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actCreateResource(context: Event) {
  const resource = await createResourceServices(
    createResourceSchema.parse(await readRequestBody(context.req)),
    context.get("auth")!,
  );
  return context.json(resource, {
    status: 201,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actUpdateResource(context: Event) {
  return context.json(
    await updateResourceServices(
      uuidSchema.parse(context.req.param("id")!),
      updateResourceSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actDeleteResource(context: Event) {
  await deleteResourceServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actListResourceCounters(context: Event) {
  return context.json(
    await listResourceCountersServices(
      uuidSchema.parse(context.req.param("id")!),
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actUpdateResourceCounter(context: Event) {
  return context.json(
    await updateResourceCounterServices(
      uuidSchema.parse(context.req.param("id")!),
      context.req.param("key")! ?? "",
      counterMutationSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actListVerifiedReferences(context: Event) {
  return context.json(
    await listVerifiedReferencesServices(
      uuidSchema.parse(context.req.param("id")!),
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actCreateVerifiedReference(context: Event) {
  const reference = await createVerifiedReferenceServices(
    uuidSchema.parse(context.req.param("id")!),
    verifiedReferenceSchema.parse(await readRequestBody(context.req)),
    context.get("auth")!,
  );
  return context.json(reference, {
    status: 201,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actDeleteVerifiedReference(context: Event) {
  await deleteVerifiedReferenceServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
