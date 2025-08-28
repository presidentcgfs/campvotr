CREATE TYPE "public"."draw_session_status" AS ENUM('scheduled', 'active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."recurrence_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."time_slot_status" AS ENUM('available', 'held', 'picked', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."turn_strategy" AS ENUM('fixed', 'randomized', 'snake');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(64) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" uuid NOT NULL,
	"diff" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "draw_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" "draw_session_status" DEFAULT 'scheduled' NOT NULL,
	"turn_strategy" "turn_strategy" DEFAULT 'fixed' NOT NULL,
	"rounds" integer,
	"pick_timeout_sec" integer DEFAULT 60 NOT NULL,
	"starts_at_utc" timestamp NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "draw_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255),
	"notes" text,
	"capacity" integer DEFAULT 1 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fields" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"role" varchar(32) DEFAULT 'participant' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "picks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"time_slot_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"turn_number" integer NOT NULL,
	"picked_at_utc" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "picks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "recurrence_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"frequency" "recurrence_frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"by_day" varchar(64),
	"window_start_utc" timestamp NOT NULL,
	"window_end_utc" timestamp NOT NULL,
	"blackout_dates" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurrence_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"start_utc" timestamp NOT NULL,
	"end_utc" timestamp NOT NULL,
	"status" time_slot_status DEFAULT 'available' NOT NULL,
	"held_by_user_id" uuid,
	"hold_expires_at" timestamp,
	"blocked_reason" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "time_slots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_sessions" ADD CONSTRAINT "draw_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fields" ADD CONSTRAINT "fields_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_draw_session_id_draw_sessions_id_fk" FOREIGN KEY ("draw_session_id") REFERENCES "public"."draw_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_draw_session_id_draw_sessions_id_fk" FOREIGN KEY ("draw_session_id") REFERENCES "public"."draw_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_field_id_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_session_user" ON "participants" USING btree ("draw_session_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_turn" ON "picks" USING btree ("draw_session_id","round_number","turn_number");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_field_timeslot_window" ON "time_slots" USING btree ("field_id","start_utc","end_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "org_field_start_idx" ON "time_slots" USING btree ("organization_id","field_id","start_utc");