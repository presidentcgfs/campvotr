CREATE TABLE "organization_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "org_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tie_breaker_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ballot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"vote_choice" "vote_choice" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "tie_breaker_user_id" uuid;--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "tie_break_resolved_at" timestamp;--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "tie_break_resolution_note" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "tie_breaker_user_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tie_breaker_votes" ADD CONSTRAINT "tie_breaker_votes_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_email_unique" ON "organization_invites" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "tie_breaker_votes_ballot_unique" ON "tie_breaker_votes" USING btree ("ballot_id");