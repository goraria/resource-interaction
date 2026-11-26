import { readRequestBody } from "@/utils/request";
import type { ApiContext } from "@/types/auth";
import { videoSubscriberSchema } from "@/schemas/video-subscriber";
import { rawListVideoSubscribers as listVideoSubscribersServices } from "@/services/video-subscriber";
import { rawReadVideoChannelStats as readVideoChannelStatsServices } from "@/services/video-subscriber";
export async function actReadVideoChannelStats(e: ApiContext) {
  const p = videoSubscriberSchema
    .pick({ channelId: true })
    .parse(await readRequestBody(e.req));
  return e.json(await readVideoChannelStatsServices(p.channelId));
}
export async function actListVideoSubscribers(e: ApiContext) {
  const p = videoSubscriberSchema.parse(await readRequestBody(e.req));
  return e.json(
    await listVideoSubscribersServices(p.channelId, p.cursor),
  );
}
