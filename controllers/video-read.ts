import { readRequestBody } from "@/modules/principle/request";
import type { Event } from "@/utils/interface";
import { videoReadSchema, videoCommentsSchema } from "@/schemas/video-read";
import {
  readVideoSummary as readVideoSummaryServices,
  readVideoComments as readVideoCommentsServices,
} from "@/services/video-read";
export async function actReadVideoSummary(e: Event) {
  const p = videoReadSchema.parse(await readRequestBody(e.req));
  return e.json(await readVideoSummaryServices(p.videoId));
}
export async function actReadVideoComments(e: Event) {
  const { videoId, ...p } = videoCommentsSchema.parse(await readRequestBody(e.req));
  return e.json(await readVideoCommentsServices(videoId, p));
}
