DROP INDEX "org_field_start_idx";--> statement-breakpoint
DROP INDEX "timeslots_field_drawsession_pattern_idx";--> statement-breakpoint
DROP INDEX "unique_field_timeslot_window";--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "start_time" time NOT NULL;--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "end_time" time NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_field_timeslot_window" ON "time_slots" USING btree ("draw_session_id","field_id","pattern","start_time","end_time");