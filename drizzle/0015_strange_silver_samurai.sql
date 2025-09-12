-- Update CHECK constraint to match full RRule format with DTSTART
ALTER TABLE "time_slots" DROP CONSTRAINT "pattern_rrule_basic_check";--> statement-breakpoint
ALTER TABLE "time_slots" ADD CONSTRAINT "pattern_rrule_basic_check" CHECK ("pattern" ~ '^DTSTART[^\\n]*\\nRRULE:FREQ=[A-Z]+(;[A-Z]+=[^;=\\n]+)*$');--> statement-breakpoint