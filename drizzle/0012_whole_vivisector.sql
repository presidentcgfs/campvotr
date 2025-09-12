ALTER TABLE "time_slots" ADD COLUMN "slot_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_slot_id_unique" UNIQUE("slot_id");