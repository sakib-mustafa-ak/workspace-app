CREATE TABLE "account_plugin_oauth_states" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"verifier" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_plugins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"credentials" text,
	"credentials_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_plugin_oauth_states" ADD CONSTRAINT "account_plugin_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_plugins" ADD CONSTRAINT "account_plugins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_plugin_oauth_states_expiry" ON "account_plugin_oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_plugins_user_key" ON "account_plugins" USING btree ("user_id","key");
--> statement-breakpoint
-- Preserve enabled add-ons for existing active members as personal settings.
INSERT INTO "account_plugins" ("id", "user_id", "key", "enabled")
SELECT gen_random_uuid(), m.user_id, p.key, true
FROM workspace_plugins p
JOIN workspace_members m ON m.workspace_id = p.workspace_id AND m.status = 'ACTIVE'
WHERE p.enabled = true AND p.key IN ('time-tracking', 'task-voting')
GROUP BY m.user_id, p.key
ON CONFLICT (user_id, key) DO NOTHING;
--> statement-breakpoint
-- Move only unambiguous personal connections; retain their original AES-GCM
-- context until tokens are refreshed and re-encrypted with account context.
-- Multiple connections for one provider require the user to reconnect explicitly.
INSERT INTO "account_plugins" ("id", "user_id", "key", "enabled", "credentials", "credentials_context")
SELECT p.id, p.connected_by, p.key, p.enabled, p.credentials,
       p.workspace_id::text || ':' || p.key || ':' || p.connected_by::text
FROM workspace_plugins p
JOIN workspace_members m ON m.workspace_id = p.workspace_id
  AND m.user_id = p.connected_by AND m.status = 'ACTIVE' AND m.role IN ('OWNER', 'ADMIN')
WHERE p.credentials IS NOT NULL AND p.connected_by IS NOT NULL
  AND (SELECT count(*) FROM workspace_plugins candidate
       WHERE candidate.connected_by = p.connected_by AND candidate.key = p.key
         AND candidate.credentials IS NOT NULL) = 1
ON CONFLICT (user_id, key) DO NOTHING;
