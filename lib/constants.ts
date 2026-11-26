export const applicationNamespaces = ["chat", "video", "reader", "social", "task", "marketplace", "restaurant"] as const;

export type GorthApplication = (typeof applicationNamespaces)[number];

export const resourceReadScopes = {
  chat: "chat:read",
  video: "video:read",
  reader: "reader:read",
  social: "social:read",
  task: "task:read",
  marketplace: "marketplace:read",
  restaurant: "restaurant:read",
} satisfies Record<GorthApplication, string>

export const resourceWriteScopes = {
  chat: "chat:write",
  video: "video:write",
  reader: "reader:write",
  social: "social:write",
  task: "task:write",
  marketplace: "marketplace:write",
  restaurant: "restaurant:write",
} satisfies Record<GorthApplication, string>
