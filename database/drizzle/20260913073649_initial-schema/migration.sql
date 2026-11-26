CREATE TYPE "collection_visibility" AS ENUM('private', 'unlisted', 'public');--> statement-breakpoint
CREATE TYPE "follow_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "interaction_status" AS ENUM('active', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "notification_level" AS ENUM('none', 'personalized', 'all');--> statement-breakpoint
CREATE TYPE "reaction_type" AS ENUM('like', 'dislike', 'love', 'haha', 'wow', 'sad', 'angry', 'upvote', 'downvote');--> statement-breakpoint
CREATE TYPE "report_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "resource_status" AS ENUM('active', 'hidden', 'deleted');--> statement-breakpoint
CREATE TYPE "save_type" AS ENUM('bookmark', 'favorite');--> statement-breakpoint
CREATE TYPE "share_channel" AS ENUM('internal', 'link', 'email', 'external');--> statement-breakpoint
CREATE TABLE "collection_resources" (
	"collection_id" uuid,
	"resource_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collection_resources_pkey" PRIMARY KEY("collection_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"visibility" "collection_visibility" DEFAULT 'private'::"collection_visibility" NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_reactions" (
	"comment_id" uuid,
	"user_id" uuid,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_pkey" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"root_id" uuid,
	"parent_id" uuid,
	"content" text NOT NULL,
	"status" "interaction_status" DEFAULT 'active'::"interaction_status" NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"reaction_count" integer DEFAULT 0 NOT NULL,
	"reply_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "comments_reaction_count_check" CHECK ("reaction_count" >= 0),
	CONSTRAINT "comments_reply_count_check" CHECK ("reply_count" >= 0),
	CONSTRAINT "comments_not_own_parent_check" CHECK ("parent_id" is null or "parent_id" <> "id")
);
--> statement-breakpoint
CREATE TABLE "rating_summaries" (
	"resource_id" uuid PRIMARY KEY,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(4,2) DEFAULT '0' NOT NULL,
	"distribution" jsonb DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"resource_id" uuid,
	"user_id" uuid,
	"value" numeric(3,2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_pkey" PRIMARY KEY("resource_id","user_id"),
	CONSTRAINT "ratings_value_check" CHECK ("value" >= 1 and "value" <= 5)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"reporter_user_id" uuid NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" text NOT NULL,
	"reason" varchar(128) NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open'::"report_status" NOT NULL,
	"resolved_by_user_id" uuid,
	"resolution" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_counters" (
	"resource_id" uuid,
	"key" varchar(64),
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_counters_pkey" PRIMARY KEY("resource_id","key"),
	CONSTRAINT "resource_counters_value_check" CHECK ("value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "resource_follows" (
	"user_id" uuid,
	"resource_id" uuid,
	"status" "follow_status" DEFAULT 'accepted'::"follow_status" NOT NULL,
	"notification_level" "notification_level" DEFAULT 'personalized'::"notification_level" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_follows_pkey" PRIMARY KEY("user_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "resource_reactions" (
	"resource_id" uuid,
	"user_id" uuid,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_reactions_pkey" PRIMARY KEY("resource_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "resource_saves" (
	"resource_id" uuid,
	"user_id" uuid,
	"type" "save_type",
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_saves_pkey" PRIMARY KEY("resource_id","user_id","type")
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"application" varchar(64) NOT NULL,
	"resource_type" varchar(64) NOT NULL,
	"resource_id" text NOT NULL,
	"owner_external_user_id" text,
	"title" text,
	"canonical_url" text,
	"image_url" text,
	"status" "resource_status" DEFAULT 'active'::"resource_status" NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "review_reactions" (
	"review_id" uuid,
	"user_id" uuid,
	"type" "reaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_reactions_pkey" PRIMARY KEY("review_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"contains_spoiler" boolean DEFAULT false NOT NULL,
	"status" "interaction_status" DEFAULT 'active'::"interaction_status" NOT NULL,
	"reaction_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	CONSTRAINT "reviews_reaction_count_check" CHECK ("reaction_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_id" uuid NOT NULL,
	"user_id" uuid,
	"channel" "share_channel" DEFAULT 'link'::"share_channel" NOT NULL,
	"destination" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"external_user_id" text NOT NULL UNIQUE,
	"name" text DEFAULT '' NOT NULL,
	"username" varchar(32) UNIQUE,
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"image" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verified_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"resource_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"source_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"verified_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "collection_resources_resource_id_idx" ON "collection_resources" ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_name_key" ON "collections" ("user_id","name");--> statement-breakpoint
CREATE INDEX "comment_reactions_user_id_idx" ON "comment_reactions" ("user_id");--> statement-breakpoint
CREATE INDEX "comments_resource_status_created_at_idx" ON "comments" ("resource_id","status","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_user_id_idx" ON "comments" ("author_user_id");--> statement-breakpoint
CREATE INDEX "comments_root_id_idx" ON "comments" ("root_id");--> statement-breakpoint
CREATE INDEX "comments_parent_id_idx" ON "comments" ("parent_id");--> statement-breakpoint
CREATE INDEX "ratings_resource_value_idx" ON "ratings" ("resource_id","value");--> statement-breakpoint
CREATE INDEX "reports_target_status_idx" ON "reports" ("target_type","target_id","status");--> statement-breakpoint
CREATE INDEX "reports_reporter_user_id_idx" ON "reports" ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "resource_follows_resource_status_idx" ON "resource_follows" ("resource_id","status");--> statement-breakpoint
CREATE INDEX "resource_reactions_user_id_idx" ON "resource_reactions" ("user_id");--> statement-breakpoint
CREATE INDEX "resource_reactions_resource_type_idx" ON "resource_reactions" ("resource_id","type");--> statement-breakpoint
CREATE INDEX "resource_saves_user_type_created_at_idx" ON "resource_saves" ("user_id","type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_application_type_resource_key" ON "resources" ("application","resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "resources_application_type_status_idx" ON "resources" ("application","resource_type","status");--> statement-breakpoint
CREATE INDEX "resources_owner_external_user_id_idx" ON "resources" ("owner_external_user_id");--> statement-breakpoint
CREATE INDEX "review_reactions_user_id_idx" ON "review_reactions" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_resource_author_key" ON "reviews" ("resource_id","author_user_id");--> statement-breakpoint
CREATE INDEX "reviews_resource_status_created_at_idx" ON "reviews" ("resource_id","status","created_at");--> statement-breakpoint
CREATE INDEX "shares_resource_created_at_idx" ON "shares" ("resource_id","created_at");--> statement-breakpoint
CREATE INDEX "shares_user_id_idx" ON "shares" ("user_id");--> statement-breakpoint
CREATE INDEX "users_last_seen_at_idx" ON "users" ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "verified_references_resource_user_source_key" ON "verified_references" ("resource_id","user_id","source_type","source_id");--> statement-breakpoint
ALTER TABLE "collection_resources" ADD CONSTRAINT "collection_resources_collection_id_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_resources" ADD CONSTRAINT "collection_resources_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_comments_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_root_id_fkey" FOREIGN KEY ("root_id") REFERENCES "comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rating_summaries" ADD CONSTRAINT "rating_summaries_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_user_id_users_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resource_counters" ADD CONSTRAINT "resource_counters_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_follows" ADD CONSTRAINT "resource_follows_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_follows" ADD CONSTRAINT "resource_follows_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_reactions" ADD CONSTRAINT "resource_reactions_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_reactions" ADD CONSTRAINT "resource_reactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_saves" ADD CONSTRAINT "resource_saves_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_saves" ADD CONSTRAINT "resource_saves_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_reactions" ADD CONSTRAINT "review_reactions_review_id_reviews_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_reactions" ADD CONSTRAINT "review_reactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_user_id_users_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "verified_references" ADD CONSTRAINT "verified_references_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "verified_references" ADD CONSTRAINT "verified_references_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;