import { votes, voteEvents, voters } from '../db/index';
import { and, desc, eq } from 'drizzle-orm';
import type { VoteChoice } from '../types';
import { ballotServiceKey } from './ballot-service';
import { pbj, pbjKey } from '@pbinj/pbj';
import { drizzleKey } from '../db/pbj';

export const adminVoteServiceKey = pbjKey<AdminVoteService>('adminVoteService');

export class AdminVoteService {
	constructor(
		private db = pbj(drizzleKey),
		private ballotService = pbj(ballotServiceKey)
	) {}

	async retrievDetailedVoteForAdmin(ballotId: string) {
		const detailedVotes = await this.db
			.select({
				id: votes.id,
				vote_choice: votes.vote_choice,
				voted_at: votes.voted_at,
				updated_at: votes.updated_at,
				voter_id: votes.voter_id,
				voter_email: voters.email,
				voter_name: voters.name
			})
			.from(votes)
			.innerJoin(voters, eq(votes.voter_id, voters.id))
			.where(eq(votes.ballot_id, ballotId))
			.orderBy(desc(votes.voted_at));
		return detailedVotes;
	}

	async retrieveBallotVotesForAdmin(ballotId: string) {
		// Fetch votes and enrich with last audit info
		const allVotes = await this.ballotService.getBallotVotes(ballotId);
		const voteCounts = await this.ballotService.getVoteCounts(ballotId);

		// Get last event per voter
		const lastEvents = await this.db
			.select()
			.from(voteEvents)
			.where(eq(voteEvents.ballot_id, ballotId))
			.orderBy(desc(voteEvents.created_at));

		const lastByVoter = new Map<string, (typeof lastEvents)[number]>();
		for (const evt of lastEvents) {
			if (!lastByVoter.has(evt.voter_id)) lastByVoter.set(evt.voter_id, evt);
		}

		const enriched = allVotes.map((v) => {
			const evt = lastByVoter.get(v.voter_id);
			return {
				...v,
				last_set_by_role: (evt as any)?.actor_role ?? 'user',
				last_set_at: (evt as any)?.created_at ?? v.updated_at
			};
		});

		return { votes: enriched, vote_counts: voteCounts };
	}

	async recordVoteEvent(data: {
		ballot_id: string;
		voter_id: string;
		actor_user_id: string;
		actor_role: 'admin' | 'owner' | 'user';
		event_type: 'cast' | 'override' | 'clear';
		previous_choice: VoteChoice | null;
		new_choice: VoteChoice | null;
		reason?: string;
	}) {
		await this.db.insert(voteEvents).values({
			ballot_id: data.ballot_id,
			voter_id: data.voter_id,
			actor_user_id: data.actor_user_id,
			actor_role: data.actor_role as any,
			event_type: data.event_type as any,
			previous_choice: data.previous_choice ?? null,
			new_choice: data.new_choice ?? null,
			reason: data.reason ?? null
		});
	}

	async updateVoteByAdmin(params: {
		ballot_id: string;
		voter_id: string;
		new_choice: VoteChoice;
		reason?: string;
		actor_user_id: string;
		actor_role: 'admin' | 'owner';
	}) {
		const existing = await this.ballotService.getUserVoteByVoterId(
			params.ballot_id,
			params.voter_id
		);
		if (!existing) {
			const [vote] = await this.db
				.insert(votes)
				.values({
					ballot_id: params.ballot_id,
					voter_id: params.voter_id,
					vote_choice: params.new_choice
				})
				.returning();

			await this.recordVoteEvent({
				ballot_id: params.ballot_id,
				voter_id: params.voter_id,
				actor_user_id: params.actor_user_id,
				actor_role: params.actor_role,
				event_type: 'override',
				previous_choice: null,
				new_choice: params.new_choice,
				reason: params.reason
			});

			return vote;
		}

		if (existing.vote_choice === params.new_choice) {
			if (params.reason) {
				await this.recordVoteEvent({
					ballot_id: params.ballot_id,
					voter_id: params.voter_id,
					actor_user_id: params.actor_user_id,
					actor_role: params.actor_role,
					event_type: 'override',
					previous_choice: existing.vote_choice,
					new_choice: existing.vote_choice,
					reason: params.reason
				});
			}
			return existing;
		}

		const [updated] = await this.db
			.update(votes)
			.set({ vote_choice: params.new_choice, updated_at: new Date() })
			.where(and(eq(votes.ballot_id, params.ballot_id), eq(votes.voter_id, params.voter_id)))
			.returning();

		await this.recordVoteEvent({
			ballot_id: params.ballot_id,
			voter_id: params.voter_id,
			actor_user_id: params.actor_user_id,
			actor_role: params.actor_role,
			event_type: 'override',
			previous_choice: existing.vote_choice,
			new_choice: params.new_choice,
			reason: params.reason
		});

		return updated;
	}
}
