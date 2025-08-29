-- Add missing tables for draw session schedules and rules
-- This extends the existing draw session structure to support RecurrenceMulti

-- Update turn_strategy enum to match the new requirements
ALTER TYPE "public"."turn_strategy" ADD VALUE 'random';
ALTER TYPE "public"."turn_strategy" ADD VALUE 'round_robin';

-- Add start_date and end_date to draw_sessions
ALTER TABLE "public"."draw_sessions" ADD COLUMN "start_date" date NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "public"."draw_sessions" ADD COLUMN "end_date" date NOT NULL DEFAULT CURRENT_DATE;

-- Create draw_session_participants table (separate from participants for email-based participants)
CREATE TABLE "public"."draw_session_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_session_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(32) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create draw_schedules table to store RecurrenceMulti data
CREATE TABLE "public"."draw_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_session_id" uuid NOT NULL,
	"recurrence" jsonb NOT NULL, -- RecurrenceMulti as JSON (source of truth)
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create draw_schedule_fields table for many-to-many relationship
CREATE TABLE "public"."draw_schedule_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_schedule_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Create draw_schedule_rules table to store generated rrule strings
CREATE TABLE "public"."draw_schedule_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_schedule_id" uuid NOT NULL,
	"rrule_string" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
ALTER TABLE "public"."draw_session_participants" ADD CONSTRAINT "draw_session_participants_draw_session_id_fk" FOREIGN KEY ("draw_session_id") REFERENCES "public"."draw_sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."draw_schedules" ADD CONSTRAINT "draw_schedules_draw_session_id_fk" FOREIGN KEY ("draw_session_id") REFERENCES "public"."draw_sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."draw_schedule_fields" ADD CONSTRAINT "draw_schedule_fields_draw_schedule_id_fk" FOREIGN KEY ("draw_schedule_id") REFERENCES "public"."draw_schedules"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."draw_schedule_fields" ADD CONSTRAINT "draw_schedule_fields_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."draw_schedule_rules" ADD CONSTRAINT "draw_schedule_rules_draw_schedule_id_fk" FOREIGN KEY ("draw_schedule_id") REFERENCES "public"."draw_schedules"("id") ON DELETE cascade ON UPDATE no action;

-- Add unique constraints
CREATE UNIQUE INDEX "unique_draw_schedule_field" ON "public"."draw_schedule_fields" ("draw_schedule_id", "field_id");

-- Enable RLS on new tables
ALTER TABLE "public"."draw_session_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."draw_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."draw_schedule_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."draw_schedule_rules" ENABLE ROW LEVEL SECURITY;
