-- Migration to enforce recurrence pattern integrity and prevent duplicate time slot definitions

-- Step 1: Drop the old slot unique constraint
ALTER TABLE "time_slots" DROP CONSTRAINT "time_slots_slot_unique";--> statement-breakpoint

-- Step 2: Add pattern column as nullable first, then populate it
ALTER TABLE "time_slots" ADD COLUMN "pattern" text;--> statement-breakpoint

-- Step 3: Update existing rows with a default pattern based on their time slot
-- For existing time slots without a pattern, create a simple FREQ=DAILY pattern
UPDATE "time_slots"
SET "pattern" = 'FREQ=DAILY;COUNT=1;DTSTART=' || to_char("start_utc", 'YYYYMMDD"T"HH24MISS"Z"')
WHERE "pattern" IS NULL;--> statement-breakpoint

-- Step 4: Now make the pattern column NOT NULL
ALTER TABLE "time_slots" ALTER COLUMN "pattern" SET NOT NULL;--> statement-breakpoint

-- Step 5: Create the composite unique index on (fieldId, organizationId, pattern)
CREATE UNIQUE INDEX "timeslots_field_org_pattern_idx" ON "time_slots" USING btree ("field_id","organization_id","pattern");--> statement-breakpoint

-- Step 6: Add CHECK constraint for basic RRule validation (full format with DTSTART)
ALTER TABLE "time_slots" ADD CONSTRAINT "pattern_rrule_basic_check" CHECK ("pattern" ~ '^DTSTART[^\\n]*\\nRRULE:FREQ=[A-Z]+(;[A-Z]+=[^;=\\n]+)*$');--> statement-breakpoint

-- Step 7: Drop the old slot column
ALTER TABLE "time_slots" DROP COLUMN "slot";--> statement-breakpoint