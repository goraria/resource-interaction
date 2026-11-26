import type { HonoRequest } from "hono";
import { HTTPError } from "nitro/h3";

export async function readRequestBody(request: HonoRequest): Promise<unknown> {
  const text = await request.text();
  if (!text) return undefined;

  const contentType = request.header("content-type")?.toLowerCase();
  if (contentType?.startsWith("application/x-www-form-urlencoded")) {
    const fields: Record<string, string | string[]> = Object.create(null);
    for (const [key, value] of new URLSearchParams(text)) {
      const previous = fields[key];
      if (Array.isArray(previous)) previous.push(value);
      else fields[key] = previous === undefined ? value : [previous, value];
    }
    return fields;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HTTPError({ status: 400, statusText: "Bad Request", message: "Invalid JSON body" });
  }
}

// Keep the existing single-value query contract, including signed provider callbacks.
export function getQueryValues(request: Request): Record<string, string> {
  const values: Record<string, string> = Object.create(null);
  for (const [key, value] of new URL(request.url).searchParams)
    if (!(key in values)) values[key] = value;
  return values;
}
