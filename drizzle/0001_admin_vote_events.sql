-- Add role enums and vote_events table, and unique index on votes (ballot_id, voter_id)
DO $$ BEGIN
  CREATE TYPE actor_role AS ENUM ('user', 'admin', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vote_event_type AS ENUM ('cast', 'override', 'clear');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add unique index for votes uniqueness
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS votes_ballot_voter_unique ON votes (ballot_id, voter_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Create vote_events table
CREATE TABLE IF NOT EXISTS vote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id uuid NOT NULL REFERENCES ballots(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL,
  actor_role actor_role NOT NULL,
  event_type vote_event_type NOT NULL,
  previous_choice vote_choice,
  new_choice vote_choice,
  reason text,
  created_at timestamp NOT NULL DEFAULT now()
);

