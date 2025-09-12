DROP INDEX "unique_field_timeslot_window";--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "slot" varchar(255) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_field_timeslot_window" ON "time_slots" USING btree ("draw_session_id","field_id","pattern","start_time","end_time","slot");--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_slot_unique" UNIQUE("slot");