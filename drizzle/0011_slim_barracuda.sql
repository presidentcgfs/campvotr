DROP TABLE "draw_session_participants" CASCADE;--> statement-breakpoint
DROP INDEX "unique_session_user";--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;