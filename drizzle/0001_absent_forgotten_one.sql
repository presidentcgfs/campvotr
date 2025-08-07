CREATE TYPE "public"."actor_role" AS ENUM('user', 'admin', 'owner');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('OWNER', 'ADMIN', 'EDITOR', 'MEMBER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."vote_event_type" AS ENUM('cast', 'override', 'clear');--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"logo_url" text,
	"primary_color" varchar(7) DEFAULT '#2563eb' NOT NULL,
	"secondary_color" varchar(7) DEFAULT '#64748b' NOT NULL,
	"accent_color" varchar(7) DEFAULT '#22c55e' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ballot_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"actor_role" "actor_role" NOT NULL,
	"event_type" "vote_event_type" NOT NULL,
	"previous_choice" "vote_choice",
	"new_choice" "vote_choice",
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ballots" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "voter_lists" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_ballot_id_ballots_id_fk" FOREIGN KEY ("ballot_id") REFERENCES "public"."ballots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_voter_id_voters_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."voters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "org_user_unique" ON "organization_memberships" USING btree ("organization_id","user_id");--> statement-breakpoint
ALTER TABLE "ballots" ADD CONSTRAINT "ballots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voter_lists" ADD CONSTRAINT "voter_lists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "votes_ballot_voter_unique" ON "votes" USING btree ("ballot_id","voter_id");