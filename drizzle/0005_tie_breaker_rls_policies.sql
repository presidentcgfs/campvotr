-- If you want to fully enforce via Postgres RLS (Supabase), apply these:
-- 1) Enable RLS
-- 2) Helper function to compute effective tie-breaker
-- 3) Insert policy allowing only effective tie-breaker
-- 4) Select policy allowing org members and ballot creator to view

-- Enable RLS
-- ALTER TABLE tie_breaker_votes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Helper function
-- CREATE OR REPLACE FUNCTION public.effective_tie_breaker_user(p_ballot_id uuid)
-- RETURNS uuid LANGUAGE sql STABLE AS $$
--   SELECT COALESCE(b.tie_breaker_user_id, o.tie_breaker_user_id)
--   FROM ballots b
--   JOIN organizations o ON o.id = b.organization_id
--   WHERE b.id = p_ballot_id
-- $$;--> statement-breakpoint

-- Insert policy
-- DROP POLICY IF EXISTS tie_breaker_vote_insert ON tie_breaker_votes;--> statement-breakpoint
-- CREATE POLICY tie_breaker_vote_insert ON tie_breaker_votes
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     auth.uid() IS NOT NULL
--     AND auth.uid() = public.effective_tie_breaker_user(ballot_id)
--   );--> statement-breakpoint

-- Select policy: org members or creator
-- DROP POLICY IF EXISTS tie_breaker_vote_select ON tie_breaker_votes;--> statement-breakpoint
-- CREATE POLICY tie_breaker_vote_select ON tie_breaker_votes
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

