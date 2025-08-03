export type VoteChoice = 'yea' | 'nay' | 'abstain';

export type BallotStatus = 'draft' | 'open' | 'closed';

export type VotingThreshold = 'simple_majority' | 'supermajority' | 'unanimous' | 'custom';

export interface User {
	id: string;
	email: string;
	created_at: string;
	updated_at: string;
}

export interface Ballot {
	id: string;
	title: string;
	description: string;
	creator_id: string;
	voter_list_id?: string;
	google_group_id?: string;
	created_at: string;
	voting_opens_at: string;
	voting_closes_at: string;
	voting_threshold: VotingThreshold;
	threshold_percentage?: string;
	quorum_required?: number;
	status: BallotStatus;
}

export interface Vote {
	id: string;
	ballot_id: string;
	user_id: string;
	vote_choice: VoteChoice;
	voted_at: string;
	updated_at: string;
}

export interface VoteCounts {
	yea: number;
	nay: number;
	abstain: number;
	total: number;
}

export interface PassingStatus {
	is_passing: boolean;
	votes_needed: number;
	required_votes: number;
	total_eligible_voters: number;
	threshold_percentage: number;
	current_percentage: number;
	total_votes_cast: number;
	vote_counts: VoteCounts;
	quorum_required?: number;
	quorum_met: boolean;
	quorum_needed?: number;
}

export interface BallotWithVotes extends Ballot {
	vote_counts: VoteCounts;
	user_vote?: Vote;
	votes?: Vote[];
	passing_status?: PassingStatus;
}

export interface Notification {
	id: string;
	user_id: string;
	ballot_id?: string;
	type: 'new_ballot' | 'voting_reminder' | 'voting_closed' | 'voting_opened';
	message: string;
	sent_at: string;
	read_at?: string;
}
