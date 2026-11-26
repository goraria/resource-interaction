import { Hono } from "hono";
import {
  actAddCollectionResource,
  actCreateCollection,
  actDeleteCollection,
  actGetCollection,
  actListCollectionResources,
  actListMyCollectionResources,
  actListMyCollections,
  actRemoveCollectionResource,
  actUpdateCollection,
} from "@/controllers/collections";
import {
  actCreateComment,
  actDeleteComment,
  actListComments,
  actUpdateComment,
} from "@/controllers/comments";
import {
  actCreateExternalComment,
  actCreateExternalReview,
  actDeleteExternalComment,
  actGetExternalResourceSummary,
  actGetMyExternalResourceState,
  actListExternalComments,
  actListExternalReviews,
  actReactToExternalComment,
  actReactToExternalResource,
  actReactToExternalReview,
  actRemoveExternalCommentReaction,
  actRemoveExternalResourceReaction,
  actRemoveExternalReviewReaction,
  actReportExternalResource,
  actSaveExternalResource,
  actShareExternalResource,
  actUnsaveExternalResource,
  actUpdateExternalComment,
} from "@/controllers/external-resources";
import {
  actFollowResource,
  actGetMyResourceInteractionState,
  actGetRatingSummary,
  actGetResourceReactionSummary,
  actListMyFollows,
  actListMySaves,
  actRateResource,
  actReactToComment,
  actReactToResource,
  actReactToReview,
  actRemoveCommentReaction,
  actRemoveRating,
  actRemoveResourceReaction,
  actRemoveReviewReaction,
  actSaveResource,
  actShareResource,
  actSubscribeResource,
  actUnfollowResource,
  actUnsaveResource,
  actUnsubscribeResource,
  actVoteOnResource,
} from "@/controllers/interactions";
import { actModerateReaderComment } from "@/controllers/reader-moderation";
import {
  actCreateReport,
  actListMyReports,
  actListReports,
  actResolveReport,
} from "@/controllers/reports";
import {
  actCreateResource,
  actCreateVerifiedReference,
  actDeleteResource,
  actDeleteVerifiedReference,
  actGetResource,
  actListResourceCounters,
  actListResources,
  actListVerifiedReferences,
  actResolveResource,
  actUpdateResource,
  actUpdateResourceCounter,
} from "@/controllers/resources";
import {
  actCreateReview,
  actDeleteReview,
  actListReviews,
  actUpdateReview,
} from "@/controllers/reviews";
import { actReceiveTaskPolicySnapshot } from "@/controllers/task-policy-sync";
import { actGetCurrentUser } from "@/controllers/users";
import {
  actReadVideoComments,
  actReadVideoSummary,
} from "@/controllers/video-read";
import {
  actListVideoSubscribers,
  actReadVideoChannelStats,
} from "@/controllers/video-subscriber";
import { requireAuth } from "@/middlewares/auth";
import { requireTaskPolicyEvent } from "@/middlewares/task-policy-event";
import { protectTaskResource } from "@/middlewares/task-resource";
import { requireVideoWorker } from "@/middlewares/video-worker";

export const resourceRoutes = new Hono();

resourceRoutes.post(
  "/policy/task/snapshot",
  requireTaskPolicyEvent(),
  actReceiveTaskPolicySnapshot,
);
resourceRoutes.delete(
  "/me/collection/:id/resource/:resourceId",
  requireAuth("write"),
  actRemoveCollectionResource,
);
resourceRoutes.put(
  "/me/collection/:id/resource/:resourceId",
  requireAuth("write"),
  actAddCollectionResource,
);
resourceRoutes.delete(
  "/comment/item/:id/react",
  requireAuth("write"),
  protectTaskResource("comment", "comment"),
  actRemoveCommentReaction,
);
resourceRoutes.put(
  "/comment/item/:id/react",
  requireAuth("write"),
  protectTaskResource("comment", "comment"),
  actReactToComment,
);
resourceRoutes.get(
  "/me/collection/:id/resource",
  requireAuth("read"),
  actListMyCollectionResources,
);
resourceRoutes.patch(
  "/reader/comment/:id/moderation",
  requireAuth("write"),
  actModerateReaderComment,
);
resourceRoutes.delete(
  "/comment/item/:id",
  requireAuth("write"),
  protectTaskResource("comment", "comment"),
  actDeleteComment,
);
resourceRoutes.patch(
  "/comment/item/:id",
  requireAuth("write"),
  protectTaskResource("comment", "comment"),
  actUpdateComment,
);
resourceRoutes.delete("/me/collection/:id", requireAuth("write"), actDeleteCollection);
resourceRoutes.patch("/me/collection/:id", requireAuth("write"), actUpdateCollection);
resourceRoutes.get(
  "/entity/resolve",
  protectTaskResource("resource", "read"),
  actResolveResource,
);
resourceRoutes.get("/me/bookmark", requireAuth("read"), actListMySaves);
resourceRoutes.get("/me/collection", requireAuth("read"), actListMyCollections);
resourceRoutes.post("/me/collection", requireAuth("write"), actCreateCollection);
resourceRoutes.get("/me/follow", requireAuth("read"), actListMyFollows);
resourceRoutes.get("/me/report", requireAuth("read"), actListMyReports);
resourceRoutes.delete(
  "/react/comment",
  requireAuth("write"),
  protectTaskResource("comment", "read"),
  actRemoveExternalCommentReaction,
);
resourceRoutes.put(
  "/react/comment",
  requireAuth("write"),
  protectTaskResource("comment", "read"),
  actReactToExternalComment,
);
resourceRoutes.delete(
  "/react/review",
  requireAuth("write"),
  protectTaskResource("review", "read"),
  actRemoveExternalReviewReaction,
);
resourceRoutes.put(
  "/react/review",
  requireAuth("write"),
  protectTaskResource("review", "read"),
  actReactToExternalReview,
);
resourceRoutes.get("/user/me", requireAuth("read"), actGetCurrentUser);
resourceRoutes.post(
  "/video/channel-stats",
  requireVideoWorker(),
  actReadVideoChannelStats,
);
resourceRoutes.post("/video/comment", requireVideoWorker(), actReadVideoComments);
resourceRoutes.post("/video/subscriber", requireVideoWorker(), actListVideoSubscribers);
resourceRoutes.post("/video/summary", requireVideoWorker(), actReadVideoSummary);
resourceRoutes.get(
  "/entity/:id/rating/summary",
  protectTaskResource("entity", "read"),
  actGetRatingSummary,
);
resourceRoutes.delete(
  "/entity/:id/bookmark/:type",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actUnsaveResource,
);
resourceRoutes.put(
  "/entity/:id/bookmark/:type",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actSaveResource,
);
resourceRoutes.patch(
  "/entity/:id/counter/:key",
  requireAuth("write"),
  protectTaskResource("resource", "read"),
  actUpdateResourceCounter,
);
resourceRoutes.get("/collection/:id/resource", actListCollectionResources);
resourceRoutes.get(
  "/entity/:id/comment",
  protectTaskResource("entity", "read"),
  actListComments,
);
resourceRoutes.post(
  "/entity/:id/comment",
  requireAuth("write"),
  protectTaskResource("entity", "comment"),
  actCreateComment,
);
resourceRoutes.get(
  "/entity/:id/counter",
  protectTaskResource("resource", "read"),
  actListResourceCounters,
);
resourceRoutes.delete(
  "/entity/:id/follow",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actUnfollowResource,
);
resourceRoutes.put(
  "/entity/:id/follow",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actFollowResource,
);
resourceRoutes.delete(
  "/entity/:id/rating",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actRemoveRating,
);
resourceRoutes.put(
  "/entity/:id/rating",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actRateResource,
);
resourceRoutes.delete(
  "/entity/:id/react",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actRemoveResourceReaction,
);
resourceRoutes.get(
  "/entity/:id/react",
  protectTaskResource("entity", "read"),
  actGetResourceReactionSummary,
);
resourceRoutes.put(
  "/entity/:id/react",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actReactToResource,
);
resourceRoutes.get(
  "/entity/:id/reference",
  protectTaskResource("resource", "read"),
  actListVerifiedReferences,
);
resourceRoutes.post(
  "/entity/:id/reference",
  requireAuth("write"),
  protectTaskResource("resource", "read"),
  actCreateVerifiedReference,
);
resourceRoutes.get(
  "/entity/:id/review",
  protectTaskResource("entity", "read"),
  actListReviews,
);
resourceRoutes.post(
  "/entity/:id/review",
  requireAuth("write"),
  protectTaskResource("entity", "comment"),
  actCreateReview,
);
resourceRoutes.post(
  "/entity/:id/share",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actShareResource,
);
resourceRoutes.get(
  "/entity/:id/state",
  requireAuth("read"),
  protectTaskResource("entity", "read"),
  actGetMyResourceInteractionState,
);
resourceRoutes.delete(
  "/entity/:id/subscribe",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actUnsubscribeResource,
);
resourceRoutes.put(
  "/entity/:id/subscribe",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actSubscribeResource,
);
resourceRoutes.delete(
  "/entity/:id/vote",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actRemoveResourceReaction,
);
resourceRoutes.put(
  "/entity/:id/vote",
  requireAuth("write"),
  protectTaskResource("entity", "read"),
  actVoteOnResource,
);
resourceRoutes.delete(
  "/review/:id/react",
  requireAuth("write"),
  protectTaskResource("review", "comment"),
  actRemoveReviewReaction,
);
resourceRoutes.put(
  "/review/:id/react",
  requireAuth("write"),
  protectTaskResource("review", "comment"),
  actReactToReview,
);
resourceRoutes.get(
  "/target/:resourceType/review",
  protectTaskResource("external","read"),
  actListExternalReviews,
);
resourceRoutes.post(
  "/target/:resourceType/review",
  requireAuth("write"),
  protectTaskResource("external","comment"),
  actCreateExternalReview,
);
resourceRoutes.delete(
  "/bookmark/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "read"),
  actUnsaveExternalResource,
);
resourceRoutes.put(
  "/bookmark/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "read"),
  actSaveExternalResource,
);
resourceRoutes.get("/collection/:id", actGetCollection);
resourceRoutes.delete(
  "/comment/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "comment"),
  actDeleteExternalComment,
);
resourceRoutes.get(
  "/comment/:resourceType",
  protectTaskResource("external", "read"),
  actListExternalComments,
);
resourceRoutes.patch(
  "/comment/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "comment"),
  actUpdateExternalComment,
);
resourceRoutes.post(
  "/comment/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "comment"),
  actCreateExternalComment,
);
resourceRoutes.delete(
  "/entity/:id",
  requireAuth("write"),
  protectTaskResource("resource", "read"),
  actDeleteResource,
);
resourceRoutes.get("/entity/:id", protectTaskResource("resource", "read"), actGetResource);
resourceRoutes.patch(
  "/entity/:id",
  requireAuth("write"),
  protectTaskResource("resource", "read"),
  actUpdateResource,
);
resourceRoutes.delete(
  "/react/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "read"),
  actRemoveExternalResourceReaction,
);
resourceRoutes.put(
  "/react/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "read"),
  actReactToExternalResource,
);
resourceRoutes.delete(
  "/reference/:id",
  requireAuth("write"),
  protectTaskResource("reference", "read"),
  actDeleteVerifiedReference,
);
resourceRoutes.patch("/report/:id", requireAuth("write"), actResolveReport);
resourceRoutes.post(
  "/report/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "read"),
  actReportExternalResource,
);
resourceRoutes.delete(
  "/review/:id",
  requireAuth("write"),
  protectTaskResource("review", "comment"),
  actDeleteReview,
);
resourceRoutes.patch(
  "/review/:id",
  requireAuth("write"),
  protectTaskResource("review", "comment"),
  actUpdateReview,
);
resourceRoutes.post(
  "/share/:resourceType",
  requireAuth("write"),
  protectTaskResource("external", "read"),
  actShareExternalResource,
);
resourceRoutes.get(
  "/state/:resourceType",
  requireAuth("read"),
  protectTaskResource("external", "read"),
  actGetMyExternalResourceState,
);
resourceRoutes.get(
  "/summary/:resourceType",
  protectTaskResource("external", "read"),
  actGetExternalResourceSummary,
);
resourceRoutes.get("/entity", protectTaskResource("resource", "read"), actListResources);
resourceRoutes.post(
  "/entity",
  requireAuth("write"),
  protectTaskResource("resource", "read"),
  actCreateResource,
);
resourceRoutes.get("/report", requireAuth("read"), actListReports);
resourceRoutes.post("/report", requireAuth("write"), actCreateReport);
