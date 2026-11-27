import type { Event } from "@/utils/interface";
import { getQueryValues, readRequestBody } from "@/utils/request";
import { paginationSchema, uuidSchema } from "@/schemas/common";
import {
  addCollectionResourceSchema,
  createCollectionSchema,
  updateCollectionSchema,
} from "@/schemas/collections";
import {
  rawAddCollectionResource as addCollectionResourceServices,
  rawCreateCollection as createCollectionServices,
  rawDeleteCollection as deleteCollectionServices,
  rawGetCollection as getCollectionServices,
  rawListCollectionResources as listCollectionResourcesServices,
  rawListMyCollections as listMyCollectionsServices,
  rawRemoveCollectionResource as removeCollectionResourceServices,
  rawUpdateCollection as updateCollectionServices,
} from "@/models/collections";

export async function actListMyCollections(context: Event) {
  const { limit, offset } = paginationSchema.parse(getQueryValues(context.req.raw));
  return context.json(
    await listMyCollectionsServices(context.get("auth")!, limit, offset),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actGetCollection(context: Event) {
  return context.json(
    await getCollectionServices(
      uuidSchema.parse(context.req.param("id")!),
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actCreateCollection(context: Event) {
  const collection = await createCollectionServices(
    createCollectionSchema.parse(await readRequestBody(context.req)),
    context.get("auth")!,
  );
  return context.json(collection, {
    status: 201,
    headers: { "content-type": "application/json; charset=UTF-8" },
  });
}
export async function actUpdateCollection(context: Event) {
  return context.json(
    await updateCollectionServices(
      uuidSchema.parse(context.req.param("id")!),
      updateCollectionSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actDeleteCollection(context: Event) {
  await deleteCollectionServices(
    uuidSchema.parse(context.req.param("id")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
export async function actListCollectionResources(context: Event) {
  return context.json(
    await listCollectionResourcesServices(
      uuidSchema.parse(context.req.param("id")!),
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actListMyCollectionResources(context: Event) {
  return context.json(
    await listCollectionResourcesServices(
      uuidSchema.parse(context.req.param("id")!),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actAddCollectionResource(context: Event) {
  return context.json(
    await addCollectionResourceServices(
      uuidSchema.parse(context.req.param("id")!),
      uuidSchema.parse(context.req.param("resourceId")!),
      addCollectionResourceSchema.parse(await readRequestBody(context.req)),
      context.get("auth")!,
    ),
    { headers: { "content-type": "application/json; charset=UTF-8" } },
  );
}
export async function actRemoveCollectionResource(context: Event) {
  await removeCollectionResourceServices(
    uuidSchema.parse(context.req.param("id")!),
    uuidSchema.parse(context.req.param("resourceId")!),
    context.get("auth")!,
  );
  return new Response(null, { status: 204 });
}
