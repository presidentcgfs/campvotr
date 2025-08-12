-- Extend tie_breaker_votes with note and ip_address, and add RLS scaffolding
ALTER TABLE tie_breaker_votes ADD COLUMN IF NOT EXISTS note text;--> statement-breakpoint
ALTER TABLE tie_breaker_votes ADD COLUMN IF NOT EXISTS ip_address varchar(64);--> statement-breakpoint

-- RLS: Enable RLS on tie_breaker_votes if desired by project conventions (currently disabled by default)
-- Uncomment if your database uses RLS
-- ALTER TABLE tie_breaker_votes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- RLS policy: Only effective tie-breaker can insert one row for the ballot
-- This policy assumes helper SQL function effective_tie_breaker_user(ballot_id uuid) returns uuid or null
-- and that application sets auth.uid() to the Supabase user id (when using Supabase)
-- CREATE OR REPLACE FUNCTION effective_tie_breaker_user(p_ballot_id uuid)
-- RETURNS uuid LANGUAGE sql STABLE AS $$
--   SELECT COALESCE(b.tie_breaker_user_id, o.tie_breaker_user_id)
--   FROM ballots b
--   JOIN organizations o ON o.id = b.organization_id
--   WHERE b.id = p_ballot_id
-- $$;--> statement-breakpoint

-- DROP POLICY IF EXISTS tie_breaker_insert ON tie_breaker_votes;--> statement-breakpoint
-- CREATE POLICY tie_breaker_insert ON tie_breaker_votes
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     auth.uid() IS NOT NULL
--     AND auth.uid() = effective_tie_breaker_user(ballot_id)
--   );--> statement-breakpoint

-- Optional read policy: allow org members and ballot creator to read
-- CREATE POLICY tie_breaker_select ON tie_breaker_votes
--   FOR SELECT TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1
--       FROM ballots b
--       JOIN organizations o ON o.id = b.organization_id
--       JOIN organization_memberships m ON m.organization_id = o.id AND m.user_id = auth.uid()
--       WHERE b.id = tie_breaker_votes.ballot_id
--     ) OR EXISTS (
--       SELECT 1 FROM ballots b WHERE b.id = tie_breaker_votes.ballot_id AND b.creator_id = auth.uid()
--     )
--   );

