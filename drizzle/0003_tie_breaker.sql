-- Tie-breaker feature migration
-- 1) organizations.tie_breaker_user_id
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS tie_breaker_user_id uuid;--> statement-breakpoint

-- 2) ballots tie-breaker fields
ALTER TABLE ballots ADD COLUMN IF NOT EXISTS tie_breaker_user_id uuid;--> statement-breakpoint
ALTER TABLE ballots ADD COLUMN IF NOT EXISTS tie_break_resolved_at timestamp;--> statement-breakpoint
ALTER TABLE ballots ADD COLUMN IF NOT EXISTS tie_break_resolution_note text;--> statement-breakpoint

-- 3) tie_breaker_votes table (one per ballot)
CREATE TABLE IF NOT EXISTS tie_breaker_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id uuid NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote_choice vote_choice NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
-- Ensure one tie-breaker vote per ballot
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS tie_breaker_votes_ballot_unique ON tie_breaker_votes (ballot_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

