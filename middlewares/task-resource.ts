import type { Binding, Event } from "@/utils/interface";
import type { MiddlewareHandler } from "hono";

import { getQueryValues } from "@/utils/request";
import { ServiceError } from "@/lib/errors";
import { requireAuth } from "@/middlewares/auth";
import { assertSocialAccess } from "@/services/social-policy";
import { assertReaderAccess } from "@/services/reader-policy";
import { assertVideoAccess } from "@/services/video-policy";
import {
  rawAssertTaskResourceAccess,
  rawFindTaskRequestResource,
} from "@/services/task-policy";

import type {
  TaskResourceAccess,
  TaskResourceLookup,
  TaskResourceLookupKind,
} from "@/utils/interface";
export function protectTaskResource(
  kind: TaskResourceLookupKind,
  access: TaskResourceAccess = "read",
): MiddlewareHandler<Binding> {
  return async (context: Event, next) => {
    const params = context.req.param() as Record<string, string>,
      query = getQueryValues(context.req.raw);
    const lookup: TaskResourceLookup = {
      kind,
      resourceType: params.resourceType ?? query.resourceType,
      resourceId: query.id ?? query.resourceId,
      application: query.application,
    };
    if (kind === "entity") lookup.entityId = params.id;
    if (kind === "comment") lookup.commentId = params.id ?? query.id;
    if (kind === "review") lookup.reviewId = params.id ?? query.id;
    if (kind === "reference") lookup.referenceId = params.id;
    if (kind === "external") {
      lookup.commentId = query.comment;
      lookup.reviewId = query.review;
    }
    const existingAuth = context.get("auth")!;
    if (kind === "resource") {
      if (params.id) lookup.entityId = params.id;
      else if (context.req.method === "POST") {
        const body = await (context.req.raw.clone().json() as Promise<{
          resourceType?: string;
          resourceId?: string;
        }>);
        lookup.resourceType = body.resourceType;
        lookup.resourceId = body.resourceId;
      }
    }
    if (
      ["task", "social", "reader", "video"].includes(existingAuth?.application ?? "") &&
      lookup.resourceId &&
      !lookup.entityId &&
      !lookup.commentId &&
      !lookup.reviewId
    )
      lookup.application = existingAuth.application;
    let reference = await rawFindTaskRequestResource(lookup);
    if (
      !reference &&
      ["task", "social", "reader", "video"].includes(existingAuth?.application ?? "") &&
      lookup.resourceType &&
      lookup.resourceId
    )
      reference = {
        application: existingAuth.application,
        resourceType: lookup.resourceType,
        resourceId: lookup.resourceId,
      };
    if (
      !reference &&
      lookup.application === "reader" &&
      lookup.resourceId &&
      lookup.resourceType
    )
      reference = {
        application: "reader",
        resourceId: lookup.resourceId,
        resourceType: lookup.resourceType,
      };
    if (reference?.application === "reader") {
      const authorizeReader = async () => {
        if (context.get("auth")?.application !== "reader")
          throw new ServiceError("reader_resource_forbidden", 403);
        const method = context.req.method,
          path = new URL(context.req.url).pathname;
        await assertReaderAccess(
          reference!,
          context.req.raw.headers.get("authorization") ?? "",
          method === "POST" && path.includes("/comment")
            ? "comment"
            : method === "POST" && path.includes("/share")
              ? "share"
              : !["GET", "HEAD", "DELETE"].includes(method) &&
                  !path.includes("/report")
                ? "interact"
                : "read",
        );
        return next();
      };
      return existingAuth
        ? authorizeReader()
        : requireAuth(access === "read" ? "read" : "write")(
            context,
            authorizeReader,
          );
    }
    if (reference?.application === "video") {
      if (context.get("auth")?.application !== "video") throw new ServiceError("video_resource_forbidden",403);
      await assertVideoAccess(reference,context.req.raw.headers.get("authorization")??"","read");
      return next();
    }
    if (reference?.application === "social") {
      const authorizeSocial = async () => {
        if (context.get("auth")?.application !== "social")
          throw new ServiceError("social_resource_forbidden", 403);
        const path = new URL(context.req.url).pathname;
        const action =
          context.req.method === "POST" && path.includes("/share")
            ? "share"
            : context.req.method === "POST" && path.includes("/comment")
              ? "comment"
              : !["GET", "HEAD", "DELETE"].includes(context.req.method) &&
                  !path.includes("/report")
                ? "interact"
                : "read";
        await assertSocialAccess(
          reference!,
          context.req.raw.headers.get("authorization") ?? "",
          action,
        );
        return next();
      };
      return existingAuth
        ? authorizeSocial()
        : requireAuth(access === "read" ? "read" : "write")(
            context,
            authorizeSocial,
          );
    }
    if (reference?.application !== "task") return await next();
    if (
      (lookup.commentId || lookup.reviewId) &&
      lookup.resourceId &&
      lookup.resourceId !== reference.resourceId
    )
      throw new ServiceError("task_resource_mismatch", 403);
    const authorize = async () => {
      const auth = context.get("auth")!;
      if (auth?.application !== "task")
        throw new ServiceError("task_resource_forbidden", 403);
      await rawAssertTaskResourceAccess(reference!, auth, access);
      return await next();
    };
    if (existingAuth) return await authorize();
    return await requireAuth(access === "read" ? "read" : "write")(
      context,
      authorize,
    );
  };
}
