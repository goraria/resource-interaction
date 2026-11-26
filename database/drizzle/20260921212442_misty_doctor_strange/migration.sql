CREATE TABLE "resource_subscriptions" (
	"user_id" uuid,
	"resource_id" uuid,
	"notification_level" "notification_level" DEFAULT 'all'::"notification_level" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resource_subscriptions_pkey" PRIMARY KEY("user_id","resource_id")
);
--> statement-breakpoint
CREATE INDEX "resource_subscriptions_resource_id_idx" ON "resource_subscriptions" ("resource_id");--> statement-breakpoint
ALTER TABLE "resource_subscriptions" ADD CONSTRAINT "resource_subscriptions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_subscriptions" ADD CONSTRAINT "resource_subscriptions_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;