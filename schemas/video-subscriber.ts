import { z } from "zod";
export const videoSubscriberSchema = z
  .object({ channelId: z.uuid(), cursor: z.uuid().nullable().default(null) })
  .strict();
