export interface TaskResourceReference {
  application: string;
  resourceType: string;
  resourceId: string;
}
export type TaskResourceLookupKind =
  "external" | "entity" | "comment" | "review" | "reference" | "resource";
export type TaskResourceAccess = "read" | "comment";
export interface TaskResourceLookup {
  kind: TaskResourceLookupKind;
  entityId?: string;
  commentId?: string;
  reviewId?: string;
  referenceId?: string;
  application?: string;
  resourceType?: string;
  resourceId?: string;
}

export type ServiceAccess = "read" | "write";

export interface TaskPolicyCheckpoint {
  epoch: string;
  revision: bigint;
  snapshotId: string;
  digest: string;
  issuedAt: Date;
  expiresAt: Date;
}
import type { Context } from "hono";
import type { User } from "@/database/schema";
import type { Application } from "@/utils/constant";

export interface AuthContext {
  application: Application;
  clientId: string;
  scopes: string[];
  sessionId: string | null;
  user: User;
}

export interface Session {
  auth: AuthContext;
  taskPolicyBody: string;
}

export interface Binding {
  Variables: Partial<Session>
}

export type Event = Context<Binding>;
