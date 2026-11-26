import { beforeEach, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({
  find: vi.fn(),
  summary: vi.fn(),
  comments: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("@/models/resources", () => ({
  rawFindExternalResource: f.find,
  rawGetExternalResourceSummary: f.summary,
}));
vi.mock("@/models/comments", () => ({ rawListComments: f.comments }));
vi.mock("@/lib/auth/machine", () => ({ verifyMachineRequest: f.verify }));
vi.mock("@/lib/auth/verification", () => ({
  serviceAuthFailure: () => new Response(null, { status: 403 }),
}));
import { readVideoSummary, readVideoComments } from "@/services/video-read";
import { videoReadSchema, videoCommentsSchema } from "@/schemas/video-read";
import { requireVideoWorker } from "@/middlewares/video-worker";
beforeEach(() => {
  vi.clearAllMocks();
  f.find.mockResolvedValue({ id: "resource" });
  f.summary.mockResolvedValue({ reactions: [] });
  f.comments.mockResolvedValue({ data: [] });
  f.verify.mockResolvedValue({});
});
it("scopes all guest-delegated lookups to Video without creating or copying a resource", async () => {
  await readVideoSummary("video");
  expect(f.summary).toHaveBeenCalledWith({
    application: "video",
    resourceType: "video",
    resourceId: "video",
  });
  await readVideoComments("video", { limit: 10, offset: 0 });
  expect(f.find).toHaveBeenCalledWith({
    application: "video",
    resourceType: "video",
    resourceId: "video",
  });
  expect(f.comments).toHaveBeenCalledWith("resource", { limit: 10, offset: 0 });
});
it("returns a real empty collection when there are no interactions", async () => {
  f.find.mockResolvedValue(null);
  expect(
    await readVideoComments("video", { limit: 10, offset: 0 }),
  ).toMatchObject({ data: [], pagination: { total: 0, hasMore: false } });
  expect(f.comments).not.toHaveBeenCalled();
});
it("rejects arbitrary application, endpoint and excessive paging fields", () => {
  const videoId = crypto.randomUUID();
  expect(
    videoReadSchema.safeParse({ videoId, application: "task" }).success,
  ).toBe(false);
  expect(
    videoReadSchema.safeParse({ videoId, endpoint: "https://foreign.test" })
      .success,
  ).toBe(false);
  expect(videoCommentsSchema.safeParse({ videoId, limit: 1000 }).success).toBe(
    false,
  );
});
it("requires the backend-only Video Resource scope", async () => {
  const req = new Request(
      "https://resource.example.test/resource/video/comment",
    ),
    next = vi.fn(async () => new Response("ok"));
  await requireVideoWorker()({ req: { raw: req } } as never, next as never);
  expect(f.verify).toHaveBeenCalledWith(req, "video:resource:read");
  f.verify.mockRejectedValue(new Error("user token"));
  next.mockClear();
  expect(
    ((await requireVideoWorker()({ req: { raw: req } } as never, next as never)) as Response)
      .status,
  ).toBe(403);
  expect(next).not.toHaveBeenCalled();
});
