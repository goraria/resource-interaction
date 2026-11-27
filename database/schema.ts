export { rateLimit } from "@/database/rate-limit";
import { sql } from "drizzle-orm";
export { taskPolicyProjectionTable, taskPolicyGrantTable } from "@/database/task-policy";
import { relations } from "drizzle-orm/_relations";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const resourceStatus = pgEnum("resource_status", [
  "active",
  "hidden",
  "deleted",
]);

export const interactionStatus = pgEnum("interaction_status", [
  "active",
  "hidden",
  "deleted",
]);

export const followStatus = pgEnum("follow_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const notificationLevel = pgEnum("notification_level", [
  "none",
  "personalized",
  "all",
]);

export const reactionType = pgEnum("reaction_type", [
  "like",
  "dislike",
  "love",
  "haha",
  "wow",
  "sad",
  "angry",
  "upvote",
  "downvote",
]);

export const saveType = pgEnum("save_type", ["bookmark", "favorite"]);

export const shareChannel = pgEnum("share_channel", [
  "internal",
  "link",
  "email",
  "external",
]);

export const collectionVisibility = pgEnum("collection_visibility", [
  "private",
  "unlisted",
  "public",
]);

export const reportStatus = pgEnum("report_status", [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
]);

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalUserId: text("external_user_id").notNull().unique(),
    name: text("name").notNull().default(""),
    username: varchar("username", { length: 32 }).unique(),
    role: varchar("role", { length: 32 }).notNull().default("user"),
    email: varchar("email", { length: 255 }).notNull().unique(),
    image: text("image"),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("users_last_seen_at_idx").on(table.lastSeenAt)],
);

export const resourcesTable = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    application: varchar("application", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: text("resource_id").notNull(),
    ownerExternalUserId: text("owner_external_user_id"),
    title: text("title"),
    canonicalUrl: text("canonical_url"),
    imageUrl: text("image_url"),
    status: resourceStatus("status").notNull().default("active"),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("resources_application_type_resource_key").on(
      table.application,
      table.resourceType,
      table.resourceId,
    ),
    index("resources_application_type_status_idx").on(
      table.application,
      table.resourceType,
      table.status,
    ),
    index("resources_owner_external_user_id_idx").on(table.ownerExternalUserId),
  ],
);

export const resourceFollowsTable = pgTable(
  "resource_follows",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    status: followStatus("status").notNull().default("accepted"),
    notificationLevel: notificationLevel("notification_level")
      .notNull()
      .default("personalized"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.resourceId] }),
    index("resource_follows_resource_status_idx").on(
      table.resourceId,
      table.status,
    ),
  ],
);

export const resourceSubscriptionsTable = pgTable(
  "resource_subscriptions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    notificationLevel: notificationLevel("notification_level")
      .notNull()
      .default("all"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.resourceId] }),
    index("resource_subscriptions_resource_id_idx").on(table.resourceId),
  ],
);

export const commentsTable = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    rootId: uuid("root_id"),
    parentId: uuid("parent_id"),
    content: text("content").notNull(),
    status: interactionStatus("status").notNull().default("active"),
    isPinned: boolean("is_pinned").notNull().default(false),
    reactionCount: integer("reaction_count").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { mode: "date" }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    foreignKey({
      columns: [table.rootId],
      foreignColumns: [table.id],
      name: "comments_root_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "comments_parent_id_fkey",
    }).onDelete("cascade"),
    index("comments_resource_status_created_at_idx").on(
      table.resourceId,
      table.status,
      table.createdAt,
    ),
    index("comments_author_user_id_idx").on(table.authorUserId),
    index("comments_root_id_idx").on(table.rootId),
    index("comments_parent_id_idx").on(table.parentId),
    check("comments_reaction_count_check", sql`${table.reactionCount} >= 0`),
    check("comments_reply_count_check", sql`${table.replyCount} >= 0`),
    check(
      "comments_not_own_parent_check",
      sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`,
    ),
  ],
);

export const resourceReactionsTable = pgTable(
  "resource_reactions",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: reactionType("type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.userId] }),
    index("resource_reactions_user_id_idx").on(table.userId),
    index("resource_reactions_resource_type_idx").on(
      table.resourceId,
      table.type,
    ),
  ],
);

export const commentReactionsTable = pgTable(
  "comment_reactions",
  {
    commentId: uuid("comment_id")
      .notNull()
      .references(() => commentsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: reactionType("type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    index("comment_reactions_user_id_idx").on(table.userId),
  ],
);

export const resourceSavesTable = pgTable(
  "resource_saves",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: saveType("type").notNull(),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.userId, table.type] }),
    index("resource_saves_user_type_created_at_idx").on(
      table.userId,
      table.type,
      table.createdAt,
    ),
  ],
);

export const ratingsTable = pgTable(
  "ratings",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    value: numeric("value", { precision: 3, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.userId] }),
    index("ratings_resource_value_idx").on(table.resourceId, table.value),
    check(
      "ratings_value_check",
      sql`${table.value} >= 1 and ${table.value} <= 5`,
    ),
  ],
);

export const reviewsTable = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title"),
    content: text("content").notNull(),
    containsSpoiler: boolean("contains_spoiler").notNull().default(false),
    status: interactionStatus("status").notNull().default("active"),
    reactionCount: integer("reaction_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { mode: "date" }),
    deletedAt: timestamp("deleted_at", { mode: "date" }),
  },
  (table) => [
    uniqueIndex("reviews_resource_author_key").on(
      table.resourceId,
      table.authorUserId,
    ),
    index("reviews_resource_status_created_at_idx").on(
      table.resourceId,
      table.status,
      table.createdAt,
    ),
    check("reviews_reaction_count_check", sql`${table.reactionCount} >= 0`),
  ],
);

export const reviewReactionsTable = pgTable(
  "review_reactions",
  {
    reviewId: uuid("review_id")
      .notNull()
      .references(() => reviewsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: reactionType("type").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.reviewId, table.userId] }),
    index("review_reactions_user_id_idx").on(table.userId),
  ],
);

export const sharesTable = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    channel: shareChannel("channel").notNull().default("link"),
    destination: text("destination"),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("shares_resource_created_at_idx").on(
      table.resourceId,
      table.createdAt,
    ),
    index("shares_user_id_idx").on(table.userId),
  ],
);

export const collectionsTable = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    visibility: collectionVisibility("visibility").notNull().default("private"),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("collections_user_name_key").on(table.userId, table.name),
  ],
);

export const collectionResourcesTable = pgTable(
  "collection_resources",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collectionsTable.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    addedAt: timestamp("added_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.resourceId] }),
    index("collection_resources_resource_id_idx").on(table.resourceId),
  ],
);

export const resourceCountersTable = pgTable(
  "resource_counters",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 64 }).notNull(),
    value: integer("value").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.key] }),
    check("resource_counters_value_check", sql`${table.value} >= 0`),
  ],
);

export const ratingSummariesTable = pgTable("rating_summaries", {
  resourceId: uuid("resource_id")
    .primaryKey()
    .references(() => resourcesTable.id, { onDelete: "cascade" }),
  ratingCount: integer("rating_count").notNull().default(0),
  averageRating: numeric("average_rating", { precision: 4, scale: 2 })
    .notNull()
    .default("0"),
  distribution: jsonb("distribution").notNull().default(sql.raw("'{}'::jsonb")),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const verifiedReferencesTable = pgTable(
  "verified_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resourcesTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 64 }).notNull(),
    sourceId: text("source_id").notNull(),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    verifiedAt: timestamp("verified_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("verified_references_resource_user_source_key").on(
      table.resourceId,
      table.userId,
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export const reportsTable = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: text("target_id").notNull(),
    reason: varchar("reason", { length: 128 }).notNull(),
    details: text("details"),
    status: reportStatus("status").notNull().default("open"),
    resolvedByUserId: uuid("resolved_by_user_id").references(
      () => usersTable.id,
      { onDelete: "set null" },
    ),
    resolution: text("resolution"),
    metadata: jsonb("metadata").notNull().default(sql.raw("'{}'::jsonb")),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("reports_target_status_idx").on(
      table.targetType,
      table.targetId,
      table.status,
    ),
    index("reports_reporter_user_id_idx").on(table.reporterUserId),
  ],
);

export const usersRelations = relations(usersTable, ({ many }) => ({
  follows: many(resourceFollowsTable),
  subscriptions: many(resourceSubscriptionsTable),
  comments: many(commentsTable),
  resourceReactions: many(resourceReactionsTable),
  commentReactions: many(commentReactionsTable),
  saves: many(resourceSavesTable),
  ratings: many(ratingsTable),
  reviews: many(reviewsTable),
  reviewReactions: many(reviewReactionsTable),
  shares: many(sharesTable),
  collections: many(collectionsTable),
  reports: many(reportsTable),
}));

export const resourcesRelations = relations(resourcesTable, ({ many }) => ({
  follows: many(resourceFollowsTable),
  subscriptions: many(resourceSubscriptionsTable),
  comments: many(commentsTable),
  reactions: many(resourceReactionsTable),
  saves: many(resourceSavesTable),
  ratings: many(ratingsTable),
  reviews: many(reviewsTable),
  shares: many(sharesTable),
  collections: many(collectionResourcesTable),
  counters: many(resourceCountersTable),
}));

export const commentsRelations = relations(commentsTable, ({ many, one }) => ({
  resource: one(resourcesTable, {
    fields: [commentsTable.resourceId],
    references: [resourcesTable.id],
  }),
  author: one(usersTable, {
    fields: [commentsTable.authorUserId],
    references: [usersTable.id],
  }),
  parent: one(commentsTable, {
    fields: [commentsTable.parentId],
    references: [commentsTable.id],
    relationName: "commentReplies",
  }),
  replies: many(commentsTable, { relationName: "commentReplies" }),
  reactions: many(commentReactionsTable),
}));

export type User = typeof usersTable.$inferSelect;
export type Resource = typeof resourcesTable.$inferSelect;
export type ResourceFollow = typeof resourceFollowsTable.$inferSelect;
export type ResourceSubscription = typeof resourceSubscriptionsTable.$inferSelect;
export type Comment = typeof commentsTable.$inferSelect;
export type ResourceReaction = typeof resourceReactionsTable.$inferSelect;
export type CommentReaction = typeof commentReactionsTable.$inferSelect;
export type ResourceSave = typeof resourceSavesTable.$inferSelect;
export type Rating = typeof ratingsTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type ReviewReaction = typeof reviewReactionsTable.$inferSelect;
export type Share = typeof sharesTable.$inferSelect;
export type Collection = typeof collectionsTable.$inferSelect;
export type CollectionResource = typeof collectionResourcesTable.$inferSelect;
export type ResourceCounter = typeof resourceCountersTable.$inferSelect;
export type RatingSummary = typeof ratingSummariesTable.$inferSelect;
export type VerifiedReference = typeof verifiedReferencesTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
