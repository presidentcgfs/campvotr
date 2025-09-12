ALTER TABLE "time_slots" DROP CONSTRAINT "time_slots_organization_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "timeslots_field_org_pattern_idx";--> statement-breakpoint
DROP INDEX "org_field_start_idx";--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "draw_session_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_draw_session_id_draw_sessions_id_fk" FOREIGN KEY ("draw_session_id") REFERENCES "public"."draw_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_held_by_user_id_users_id_fk" FOREIGN KEY ("held_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "timeslots_field_drawsession_pattern_idx" ON "time_slots" USING btree ("field_id","draw_session_id","pattern");--> statement-breakpoint
CREATE UNIQUE INDEX "org_field_start_idx" ON "time_slots" USING btree ("draw_session_id","field_id","start_utc");--> statement-breakpoint
ALTER TABLE "time_slots" DROP COLUMN "organization_id";