import type { Context } from "hono";
import type { User } from "@/database/schema";
import type { GorthApplication } from "@/lib/constants";

export interface AuthContext {
  application: GorthApplication;
  clientId: string;
  scopes: string[];
  sessionId: string | null;
  user: User;
}

export interface AppContext {
  auth: AuthContext;
  taskPolicyBody: string;
}

export interface ApiEnv {
  Variables: Partial<AppContext>
}

export type ApiContext = Context<ApiEnv>;
