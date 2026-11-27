import { readRequestBody } from "@/utils/request";
import type { Event } from "@/utils/interface";
import { videoSubscriberSchema } from "@/schemas/video-subscriber";
import { rawListVideoSubscribers as listVideoSubscribersServices } from "@/services/video-subscriber";
import { rawReadVideoChannelStats as readVideoChannelStatsServices } from "@/services/video-subscriber";
export async function actReadVideoChannelStats(e: Event) {
  const p = videoSubscriberSchema
    .pick({ channelId: true })
    .parse(await readRequestBody(e.req));
  return e.json(await readVideoChannelStatsServices(p.channelId));
}
export async function actListVideoSubscribers(e: Event) {
  const p = videoSubscriberSchema.parse(await readRequestBody(e.req));
  return e.json(
    await listVideoSubscribersServices(p.channelId, p.cursor),
  );
}
