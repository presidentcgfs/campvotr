ALTER TABLE "organizations" ADD COLUMN "primary_domain" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_primary_domain_unique" UNIQUE("primary_domain");