import { votes } from '../db/index';
import { voters } from '../db/schema';
import { eq, or } from 'drizzle-orm';
import type { VoteChoice } from '../types';
import { authUsers } from 'drizzle-orm/supabase';
import { ballotServiceKey } from './ballot-service';
import { drizzleKey } from '../db/pbj';
import { pbj, pbjKey } from '@pbinj/pbj';
import { adminVoteServiceKey } from './vote.admin-service';

export const voteServiceKey = pbjKey<VoteService>('voteService');

export class VoteService {
	constructor(
		private db = pbj(drizzleKey),
		private adminVoteService = pbj(adminVoteServiceKey),
		private ballotService = pbj(ballotServiceKey)
	) {}
	async getVoterForUserId(userId: string) {
		const [{ voters: voter } = {}] = await this.db
			.select()
			.from(voters)
			.leftJoin(authUsers, eq(voters.email, authUsers.email))
			.where(or(eq(voters.user_id, userId), eq(authUsers.id, userId)))
			.limit(1);
		return voter;
	}

	async castVote(data: { ballot_id: string; user_id: string; vote_choice: VoteChoice }) {
		// Get voter record for this user
		const userVoter = await this.getVoterForUserId(data.user_id);
		if (!userVoter) {
			throw new Error('User is not registered as a voter');
		}

		// Check if user already voted
		const existingVote = await this.ballotService.getUserVoteByVoterId(
			data.ballot_id,
			userVoter.id
		);
		const ballot = await this.ballotService.getBallot(data.ballot_id, data.user_id);
		if (!ballot) {
			throw new Error('Ballot not found');
		}
		if (ballot.status === 'closed') {
			throw new Error('Voting has ended');
		}
		if (ballot.status !== 'open') {
			throw new Error('Voting has not started');
		}
		if (existingVote) {
			// Update vote
			const [vote] = await this.db
				.update(votes)
				.set({
					vote_choice: data.vote_choice
				})
				.where(eq(votes.id, existingVote.id))
				.returning();

			// Record audit event for user cast
			await this.adminVoteService.recordVoteEvent({
				ballot_id: data.ballot_id,
				voter_id: userVoter.id,
				actor_user_id: data.user_id,
				actor_role: 'user',
				event_type: 'cast',
				previous_choice: existingVote.vote_choice,
				new_choice: data.vote_choice
			});

			return vote;
		} else {
			// Create new vote
			const [vote] = await this.db
				.insert(votes)
				.values({
					ballot_id: data.ballot_id,
					voter_id: userVoter.id,
					vote_choice: data.vote_choice
				})
				.returning();

			// Record audit event for user cast
			await this.adminVoteService.recordVoteEvent({
				ballot_id: data.ballot_id,
				voter_id: userVoter.id,
				actor_user_id: data.user_id,
				actor_role: 'user',
				event_type: 'cast',
				previous_choice: null,
				new_choice: data.vote_choice
			});

			return vote;
		}
	}
}
