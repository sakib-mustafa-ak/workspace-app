CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"task_id" uuid NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_objects" DROP CONSTRAINT "objects_data_bounds";--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checklist_task_idx" ON "checklist_items" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "canvas_objects" ADD CONSTRAINT "objects_data_bounds" CHECK (char_length("canvas_objects"."data"::text) <= 10000000);