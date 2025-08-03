// Test utilities for CampVotr application

export function createMockUser() {
	return {
		id: 'test-user-id',
		email: 'test@example.com',
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};
}

export function createMockBallot() {
	return {
		id: 'test-ballot-id',
		title: 'Test Ballot',
		description: 'This is a test ballot for voting',
		creator_id: 'test-user-id',
		status: 'open' as const,
		voting_opens_at: new Date().toISOString(),
		voting_closes_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		vote_counts: {
			yea: 0,
			nay: 0,
			abstain: 0,
			total: 0
		}
	};
}

export function createMockVote() {
	return {
		id: 'test-vote-id',
		ballot_id: 'test-ballot-id',
		user_id: 'test-user-id',
		vote_choice: 'yea' as const,
		voted_at: new Date().toISOString()
	};
}

export function createMockNotification() {
	return {
		id: 'test-notification-id',
		user_id: 'test-user-id',
		ballot_id: 'test-ballot-id',
		type: 'new_ballot' as const,
		message: 'A new ballot has been created',
		sent_at: new Date().toISOString(),
		read_at: null
	};
}
