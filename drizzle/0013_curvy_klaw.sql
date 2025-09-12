ALTER TABLE "time_slots" DROP CONSTRAINT "time_slots_slot_id_unique";--> statement-breakpoint
ALTER TABLE "time_slots" ADD COLUMN "slot" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "time_slots" DROP COLUMN "slot_id";--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_slot_unique" UNIQUE("slot");