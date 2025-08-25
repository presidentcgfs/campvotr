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
				voteChoice: votes.voteChoice,
				votedAt: votes.votedAt,
				updatedAt: votes.updatedAt,
				voterId: votes.voterId,
				voter_email: voters.email,
				voter_name: voters.name
			})
			.from(votes)
			.innerJoin(voters, eq(votes.voterId, voters.id))
			.where(eq(votes.ballotId, ballotId))
			.orderBy(desc(votes.votedAt));
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
			.where(eq(voteEvents.ballotId, ballotId))
			.orderBy(desc(voteEvents.createdAt));

		const lastByVoter = new Map<string, (typeof lastEvents)[number]>();
		for (const evt of lastEvents) {
			if (!lastByVoter.has(evt.voterId)) lastByVoter.set(evt.voterId, evt);
		}

		const enriched = allVotes.map((v) => {
			const evt = lastByVoter.get(v.voterId);
			return {
				...v,
				last_set_by_role: (evt as any)?.actorRole ?? 'user',
				last_set_at: (evt as any)?.createdAt ?? v.updatedAt
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
			ballotId: data.ballot_id,
			voterId: data.voter_id,
			actorUserId: data.actor_user_id,
			actorRole: data.actor_role as any,
			eventType: data.event_type as any,
			previousChoice: data.previous_choice ?? null,
			newChoice: data.new_choice ?? null,
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
					ballotId: params.ballot_id,
					voterId: params.voter_id,
					voteChoice: params.new_choice
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

		if (existing.voteChoice === params.new_choice) {
			if (params.reason) {
				await this.recordVoteEvent({
					ballot_id: params.ballot_id,
					voter_id: params.voter_id,
					actor_user_id: params.actor_user_id,
					actor_role: params.actor_role,
					event_type: 'override',
					previous_choice: existing.voteChoice,
					new_choice: existing.voteChoice,
					reason: params.reason
				});
			}
			return existing;
		}

		const [updated] = await this.db
			.update(votes)
			.set({ voteChoice: params.new_choice, updatedAt: new Date() })
			.where(and(eq(votes.ballotId, params.ballot_id), eq(votes.voterId, params.voter_id)))
			.returning();

		await this.recordVoteEvent({
			ballot_id: params.ballot_id,
			voter_id: params.voter_id,
			actor_user_id: params.actor_user_id,
			actor_role: params.actor_role,
			event_type: 'override',
			previous_choice: existing.voteChoice,
			new_choice: params.new_choice,
			reason: params.reason
		});

		return updated;
	}
}
