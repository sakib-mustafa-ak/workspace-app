CREATE TYPE "public"."canvas_object_status" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."canvas_object_type" AS ENUM('RECTANGLE', 'ELLIPSE', 'TEXT', 'STICKY_NOTE', 'IMAGE', 'ARROW', 'LINE', 'PATH', 'FRAME', 'CONNECTOR');--> statement-breakpoint
CREATE TABLE "canvas" (
	"id" uuid PRIMARY KEY NOT NULL,
	"board_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text DEFAULT 'Canvas' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "canvas_objects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canvas_id" uuid NOT NULL,
	"parent_id" uuid,
	"type" "canvas_object_type" NOT NULL,
	"status" "canvas_object_status" DEFAULT 'ACTIVE' NOT NULL,
	"x" real DEFAULT 0 NOT NULL,
	"y" real DEFAULT 0 NOT NULL,
	"width" real DEFAULT 100 NOT NULL,
	"height" real DEFAULT 100 NOT NULL,
	"rotation" real DEFAULT 0 NOT NULL,
	"z_index" integer DEFAULT 0 NOT NULL,
	"fill" text,
	"stroke" text,
	"stroke_width" real DEFAULT 1 NOT NULL,
	"opacity" real DEFAULT 1 NOT NULL,
	"data" jsonb,
	"created_by_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "objects_data_bounds" CHECK (char_length("canvas_objects"."data"::text) <= 50000),
	CONSTRAINT "objects_archived_at_consistency" CHECK (("canvas_objects"."archived_at" IS NULL) OR ("canvas_objects"."status" = 'ARCHIVED'))
);
--> statement-breakpoint
CREATE TABLE "uploaded_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"board_id" uuid,
	"user_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"provider" text DEFAULT 'local' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "canvas" ADD CONSTRAINT "canvas_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas" ADD CONSTRAINT "canvas_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "canvas_objects_canvas_id_canvas_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "canvas_objects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvas_board_idx" ON "canvas" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "canvas_workspace_idx" ON "canvas" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "objects_canvas_idx" ON "canvas_objects" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX "objects_parent_idx" ON "canvas_objects" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_type_idx" ON "canvas_objects" USING btree ("type");--> statement-breakpoint
CREATE INDEX "objects_z_index_idx" ON "canvas_objects" USING btree ("z_index");--> statement-breakpoint
CREATE INDEX "uploads_workspace_idx" ON "uploaded_files" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "uploads_board_idx" ON "uploaded_files" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "uploads_user_idx" ON "uploaded_files" USING btree ("user_id");