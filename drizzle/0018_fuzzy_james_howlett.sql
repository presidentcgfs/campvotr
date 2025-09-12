DROP TABLE "recurrence_rules" CASCADE;--> statement-breakpoint
ALTER TABLE "time_slots" DROP CONSTRAINT "time_slots_held_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_held_by_user_id_participants_id_fk" FOREIGN KEY ("held_by_user_id") REFERENCES "public"."participants"("id") ON DELETE set null ON UPDATE no action;