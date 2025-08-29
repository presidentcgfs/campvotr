ALTER TYPE "public"."turn_strategy" ADD VALUE 'random';--> statement-breakpoint
ALTER TYPE "public"."turn_strategy" ADD VALUE 'round_robin';--> statement-breakpoint
CREATE TABLE "draw_schedule_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_schedule_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draw_schedule_fields" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "draw_schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_schedule_id" uuid NOT NULL,
	"rrule_string" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draw_schedule_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "draw_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_session_id" uuid NOT NULL,
	"recurrence" json NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draw_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "draw_session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_session_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draw_session_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "draw_sessions" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "draw_sessions" ADD COLUMN "end_date" date;--> statement-breakpoint
UPDATE "draw_sessions" SET "start_date" = CURRENT_DATE WHERE "start_date" IS NULL;--> statement-breakpoint
UPDATE "draw_sessions" SET "end_date" = CURRENT_DATE WHERE "end_date" IS NULL;--> statement-breakpoint
ALTER TABLE "draw_sessions" ALTER COLUMN "start_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "draw_sessions" ALTER COLUMN "end_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "draw_schedule_fields" ADD CONSTRAINT "draw_schedule_fields_draw_schedule_id_draw_schedules_id_fk" FOREIGN KEY ("draw_schedule_id") REFERENCES "public"."draw_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_schedule_fields" ADD CONSTRAINT "draw_schedule_fields_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_schedule_rules" ADD CONSTRAINT "draw_schedule_rules_draw_schedule_id_draw_schedules_id_fk" FOREIGN KEY ("draw_schedule_id") REFERENCES "public"."draw_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_schedules" ADD CONSTRAINT "draw_schedules_draw_session_id_draw_sessions_id_fk" FOREIGN KEY ("draw_session_id") REFERENCES "public"."draw_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_session_participants" ADD CONSTRAINT "draw_session_participants_draw_session_id_draw_sessions_id_fk" FOREIGN KEY ("draw_session_id") REFERENCES "public"."draw_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_draw_schedule_field" ON "draw_schedule_fields" USING btree ("draw_schedule_id","field_id");