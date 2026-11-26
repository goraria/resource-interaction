import { readRequestBody } from "@/utils/request";
import type { ApiContext } from "@/types/auth";
import { videoReadSchema, videoCommentsSchema } from "@/schemas/video-read";
import {
  readVideoSummary as readVideoSummaryServices,
  readVideoComments as readVideoCommentsServices,
} from "@/services/video-read";
export async function actReadVideoSummary(e: ApiContext) {
  const p = videoReadSchema.parse(await readRequestBody(e.req));
  return e.json(await readVideoSummaryServices(p.videoId));
}
export async function actReadVideoComments(e: ApiContext) {
  const { videoId, ...p } = videoCommentsSchema.parse(await readRequestBody(e.req));
  return e.json(await readVideoCommentsServices(videoId, p));
}
