import {
  rawFindExternalResource,
  rawGetExternalResourceSummary,
} from "@/models/resources";
import { rawListComments } from "@/models/comments";
import type { ListCommentsInput } from "@/schemas/comments";
export async function readVideoSummary(videoId: string) {
  const key = {
    application: "video",
    resourceType: "video",
    resourceId: videoId,
  };
  return rawGetExternalResourceSummary(key);
}
export async function readVideoComments(
  videoId: string,
  input: ListCommentsInput,
) {
  const resource = await rawFindExternalResource({
    application: "video",
    resourceType: "video",
    resourceId: videoId,
  });
  if (!resource)
    return { data: [], pagination: { ...input, total: 0, hasMore: false } };
  return rawListComments(resource.id, input);
}
