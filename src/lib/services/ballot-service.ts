import { ballots, votes, organizations, tieBreakerVotes } from '../db/index';
import { voters, voterListMembers, ballotVoters } from '../db/schema';
import { eq, and, desc, count, or } from 'drizzle-orm';
import type { VoteChoice, BallotStatus, VoteCounts } from '../types';
import { authUsers } from 'drizzle-orm/supabase';
import { pbj, pbjKey } from '@pbinj/pbj';
import { drizzleKey } from '../db/pbj';
import { emailServiceKey } from '$lib/services/email';
import { BaseService } from './base-service';

export const ballotServiceKey = pbjKey<BallotService>('ballotService');

export class BallotService extends BaseService {
	constructor(
		private emailService = pbj(emailServiceKey),
		db = pbj(drizzleKey)
	) {
		super(db);
	}
	async createBallot(data: {
		title: string;
		description: string;
		creator_id: string;
		organization_id: string;
		voting_opens_at: Date;
		voting_closes_at: Date;
		voting_threshold?: 'simple_majority' | 'supermajority' | 'unanimous' | 'custom';
		threshold_percentage?: number;
		quorum_required?: number;
		voter_list_id?: string;
		voter_emails?: string[];
		google_group_id?: string;
	}) {
		const [ballot] = await this.db
			.insert(ballots)
			.values({
				title: data.title,
				description: data.description,
				creator_id: data.creator_id,
				organization_id: data.organization_id,
				voting_opens_at: data.voting_opens_at,
				voting_closes_at: data.voting_closes_at,
				voting_threshold: data.voting_threshold || 'simple_majority',
				threshold_percentage: data.threshold_percentage
					? data.threshold_percentage.toString()
					: null,
				quorum_required: data.quorum_required,
				voter_list_id: data.voter_list_id,
				google_group_id: data.google_group_id,
				status: 'draft' as BallotStatus
			})
			.returning();

		const emails = data.voter_emails || [];
		if (data.voter_list_id) {
			emails.push(
				...(
					await this.db
						.select()
						.from(voterListMembers)
						.innerJoin(voters, eq(voterListMembers.voter_id, voters.id))
						.where(eq(voterListMembers.voter_list_id, data.voter_list_id))
				).map((v) => v.voters.email)
			);
		}

		if (emails.length) {
			const voterRecords = [] as any[];
			for (const email of emails) {
				// Check if voter already exists
				const [existingVoter = (await this.db.insert(voters).values({ email }).returning())?.[0]] =
					await this.db.select().from(voters).where(eq(voters.email, email)).limit(1);

				voterRecords.push(existingVoter);
			}

			// Add voters directly to the ballot
			const ballotVoterInserts = voterRecords.map((voter) => ({
				ballot_id: ballot.id,
				voter_id: voter.id
			}));

			await this.db.insert(ballotVoters).values(ballotVoterInserts);
		}

		return ballot;
	}

	async getBallots(userId: string, organizationId?: string, limit?: number) {
		// Return ballots the user created or is assigned to vote on, optionally scoped to organization

		const ands = [
			or(eq(voters.user_id, userId), eq(ballots.creator_id, userId), eq(authUsers.id, userId))
		];
		if (organizationId) {
			ands.push(eq(ballots.organization_id, organizationId));
		}
		const eligibleBallots = this.db
			.selectDistinctOn([ballots.id, ballots.created_at])
			.from(ballots)
			.leftJoin(ballotVoters, and(eq(ballots.id, ballotVoters.ballot_id)))
			.leftJoin(voters, eq(ballotVoters.voter_id, voters.id))
			.leftJoin(authUsers, eq(voters.email, authUsers.email))
			.where(ands.length === 1 ? ands[0] : and(...ands))
			.orderBy(desc(ballots.created_at));

		if (limit) {
			eligibleBallots.limit(limit);
		}
		return (await eligibleBallots).flatMap((v) => v.ballots);
	}

	async getBallot(id: string, userId: string) {
		//ugly figure

		const ballotQuery = this.db
			.selectDistinctOn([ballots.id])
			.from(ballots)
			.leftJoin(ballotVoters, eq(ballots.id, ballotVoters.ballot_id))
			.leftJoin(voters, eq(ballotVoters.voter_id, voters.id))
			.leftJoin(authUsers, eq(voters.email, authUsers.email))
			.where(
				and(
					eq(ballots.id, id),
					or(eq(ballots.creator_id, userId), eq(voters.user_id, userId), eq(authUsers.id, userId))
				)
			)
			.limit(1);
		const ballot = (await ballotQuery)[0]?.ballots;
		if (!ballot) {
			return null;
		}

		const [voteCounts, userVote, allVotes, passingStatus] = await Promise.all([
			this.getVoteCounts(id),
			this.getUserVote(id, userId),
			this.getBallotVotes(id),
			this.getBallotPassingStatus(id)
		]);

		return {
			...ballot,
			vote_counts: voteCounts,
			user_vote: userVote,
			votes: allVotes,
			passing_status: passingStatus
		};
	}

	async getRawVoteCounts(ballotId: string): Promise<VoteCounts> {
		const result = await this.db
			.select({
				vote_choice: votes.vote_choice,
				count: count()
			})
			.from(votes)
			.where(eq(votes.ballot_id, ballotId))
			.groupBy(votes.vote_choice);

		const counts = result.reduce(
			(ret, row) => {
				ret[row.vote_choice] = row.count as number;
				ret.total += row.count as number;
				return ret;
			},
			{ yea: 0, nay: 0, abstain: 0, total: 0 } as VoteCounts
		);

		return counts;
	}

	async isUserEligibleForBallot(ballotId: string, userId: string): Promise<boolean> {
		const [dv] = await this.db
			.select()
			.from(ballotVoters)
			.where(and(eq(ballotVoters.ballot_id, ballotId), eq(ballotVoters.voter_id, userId)))
			.limit(1);
		return dv != null;
	}

	async getVoteCounts(ballotId: string): Promise<VoteCounts> {
		const counts = await this.getRawVoteCounts(ballotId);
		// Also include tie-breaker vote if present
		const [tb] = await this.db
			.select()
			.from(tieBreakerVotes)
			.where(eq(tieBreakerVotes.ballot_id, ballotId))
			.limit(1);
		if (tb) {
			counts[tb.vote_choice] += 1;
			counts.total += 1;
		}
		return counts;
	}

	async getEffectiveTieBreakerUserId(ballotId: string): Promise<string | null> {
		// Fetch ballot and org to resolve effective tie-breaker
		const [b] = await this.db.select().from(ballots).where(eq(ballots.id, ballotId));
		if (!b) return null;
		if (b.tie_breaker_user_id) return b.tie_breaker_user_id;
		// Resolve from organization default
		const [org] = await this.db
			.select()
			.from(organizations)
			.where(eq(organizations.id, b.organization_id!));
		return org?.tie_breaker_user_id ?? null;
	}

	async calculateTieStatus(ballotId: string): Promise<{
		isTie: boolean;
		topChoice: VoteChoice | null;
		topCount: number;
		tiedChoices: VoteChoice[];
		tieBreakerApplied: boolean;
	}> {
		const counts = await this.getRawVoteCounts(ballotId);
		// Include tie-breaker vote if exists
		const [tb] = await this.db
			.select()
			.from(tieBreakerVotes)
			.where(eq(tieBreakerVotes.ballot_id, ballotId))
			.limit(1);
		if (tb) {
			counts[tb.vote_choice] += 1;
			counts.total += 1;
		}
		const entries: [VoteChoice, number][] = [
			['yea', counts.yea],
			['nay', counts.nay],
			['abstain', counts.abstain]
		];
		entries.sort((a, b) => b[1] - a[1]);
		const topCount = entries[0][1];
		const tiedChoices = entries.filter((e) => e[1] === topCount).map((e) => e[0]);
		return {
			isTie: tiedChoices.length > 1,
			topChoice: tiedChoices.length === 1 ? entries[0][0] : null,
			topCount,
			tiedChoices,
			tieBreakerApplied: !!tb
		};
	}

	async recordTieBreakerVote(params: {
		ballotId: string;
		userId: string;
		vote_choice: VoteChoice;
		note?: string;
		ip?: string;
	}): Promise<void> {
		// Ensure not already resolved
		const [existing] = await this.db
			.select()
			.from(tieBreakerVotes)
			.where(eq(tieBreakerVotes.ballot_id, params.ballotId))
			.limit(1);
		if (existing) throw new Error('Tie already resolved');
		await this.db.insert(tieBreakerVotes).values({
			ballot_id: params.ballotId,
			user_id: params.userId,
			vote_choice: params.vote_choice,
			note: params.note ?? null,
			ip_address: params.ip ?? null
		});
		await this.db
			.update(ballots)
			.set({ tie_break_resolved_at: new Date(), tie_break_resolution_note: params.note ?? null })
			.where(eq(ballots.id, params.ballotId));
	}

	async getBallotVotes(ballotId: string) {
		return await this.db
			.select()
			.from(votes)
			.where(eq(votes.ballot_id, ballotId))
			.orderBy(desc(votes.voted_at));
	}

	async getUserVote(ballotId: string, userId: string) {
		const [userVote] = await this.db
			.select()
			.from(votes)
			.leftJoin(voters, eq(votes.voter_id, voters.id))
			.where(and(eq(votes.ballot_id, ballotId), eq(voters.user_id, userId)))
			.limit(1);
		return userVote?.votes;
	}

	async getUserVoteByVoterId(ballotId: string, voterId: string) {
		const [vote] = await this.db
			.select()
			.from(votes)
			.where(and(eq(votes.ballot_id, ballotId), eq(votes.voter_id, voterId)))
			.limit(1);

		return vote;
	}

	async updateBallotStatus(id: string, status: BallotStatus) {
		const [ballot] = await this.db
			.update(ballots)
			.set({ status })
			.where(eq(ballots.id, id))
			.returning();

		return ballot;
	}

	async openVoting(id: string, data: { voting_opens_at: Date; voting_closes_at: Date }) {
		const [ballot] = await this.db
			.update(ballots)
			.set({
				status: 'open',
				voting_opens_at: data.voting_opens_at,
				voting_closes_at: data.voting_closes_at
			})
			.where(eq(ballots.id, id))
			.returning();

		return ballot;
	}

	async sendVoterInvitations(ballotId: string) {
		try {
			const [ballot] = await this.db
				.select()
				.from(ballots)
				.where(eq(ballots.id, ballotId))
				.limit(1);
			// Get all voters for this ballot
			const votersList = await this.getBallotVoters(ballotId);

			if (!ballot || !votersList?.length) {
				return;
			}

			// Prepare invitation data
			const invitations = votersList.map((voter) => ({
				voterEmail: voter.email,
				voterName: voter.name,
				ballotTitle: ballot.title,
				ballotDescription: ballot.description,
				votingOpensAt: new Date(ballot.voting_opens_at),
				votingClosesAt: new Date(ballot.voting_closes_at),
				ballotId: ballot.id,
				isRegisteredUser: !!voter.user_id,
				votingThreshold: ballot.voting_threshold,
				thresholdPercentage: ballot.threshold_percentage
					? parseFloat(ballot.threshold_percentage)
					: undefined
			}));

			// Send emails in bulk
			const successCount = await this.emailService.sendBulkVoterInvitations(invitations);
			console.log(
				`Sent ${successCount}/${invitations.length} voter invitations for ballot ${ballot.id}`
			);
		} catch (error) {
			console.error('Error sending voter invitations:', error);
		}
	}
	/**
	 * Calculate the required number of votes to pass based on threshold
	 */
	static calculateRequiredVotes(
		totalEligibleVoters: number,
		threshold: 'simple_majority' | 'supermajority' | 'unanimous' | 'custom',
		customPercentage?: number
	): number {
		switch (threshold) {
			case 'simple_majority':
				return Math.floor(totalEligibleVoters / 2) + 1;
			case 'supermajority':
				return Math.ceil(totalEligibleVoters * (2 / 3));
			case 'unanimous':
				return totalEligibleVoters;
			case 'custom':
				if (!customPercentage) return totalEligibleVoters;
				return Math.ceil(totalEligibleVoters * (customPercentage / 100));
			default:
				return Math.floor(totalEligibleVoters / 2) + 1;
		}
	}

	/**
	 * Calculate threshold percentage for display
	 */
	static getThresholdPercentage(
		threshold: 'simple_majority' | 'supermajority' | 'unanimous' | 'custom',
		customPercentage?: number
	): number {
		switch (threshold) {
			case 'simple_majority':
				return 50.01;
			case 'supermajority':
				return 66.67;
			case 'unanimous':
				return 100;
			case 'custom':
				return customPercentage || 50.01;
			default:
				return 50.01;
		}
	}

	/**
	 * Determine if a ballot is currently passing based on votes and threshold
	 */
	async getBallotPassingStatus(ballotId: string) {
		const [ballot] = await this.db.select().from(ballots).where(eq(ballots.id, ballotId));
		if (!ballot) throw new Error('Ballot not found');

		const [voteCounts, totalEligibleVoters] = await Promise.all([
			this.getVoteCounts(ballotId),
			this.getTotalEligibleVoters(ballotId)
		]);

		const requiredVotes = BallotService.calculateRequiredVotes(
			totalEligibleVoters,
			ballot.voting_threshold,
			ballot.threshold_percentage ? parseFloat(ballot.threshold_percentage) : undefined
		);

		const thresholdPercentage = BallotService.getThresholdPercentage(
			ballot.voting_threshold,
			ballot.threshold_percentage ? parseFloat(ballot.threshold_percentage) : undefined
		);

		const totalVotes = voteCounts.yea + voteCounts.nay + voteCounts.abstain;
		const yeaPercentage =
			totalEligibleVoters > 0 ? (voteCounts.yea / totalEligibleVoters) * 100 : 0;

		// Check quorum requirements
		const quorumRequired = (ballot as any).quorum_required as number | null | undefined;
		const quorumMet = quorumRequired ? totalVotes >= quorumRequired : true;
		const quorumNeeded = quorumRequired ? Math.max(0, quorumRequired - totalVotes) : undefined;

		// A ballot passes if it meets both the voting threshold AND quorum (if required)
		const meetsThreshold = voteCounts.yea >= requiredVotes;
		const isPassing = meetsThreshold && quorumMet;
		const isOver = Date.now() > new Date((ballot as any).voting_closes_at).getTime();
		return {
			is_passing: isPassing,
			is_over: isOver,
			votes_needed: Math.max(0, requiredVotes - voteCounts.yea),
			required_votes: requiredVotes,
			total_eligible_voters: totalEligibleVoters,
			threshold_percentage: thresholdPercentage,
			current_percentage: yeaPercentage,
			total_votes_cast: totalVotes,
			vote_counts: voteCounts,
			quorum_required: quorumRequired ?? undefined,
			quorum_met: quorumMet,
			quorum_needed: quorumNeeded
		};
	}

	/**
	 * Get total number of eligible voters for a ballot
	 */
	async getTotalEligibleVoters(ballotId: string): Promise<number> {
		// Count direct ballot voters
		const [{ total = 0 }] = await this.db
			.select({ total: count() })
			.from(ballotVoters)
			.where(eq(ballotVoters.ballot_id, ballotId))
			.limit(1);

		return total ?? 0;
	}

	async addVotersToBallot(ballotId: string, emails: string[]) {
		// Create or get existing voters and associate to ballot avoiding duplicates
		for (const email of emails) {
			const [existingVoter = (await this.db.insert(voters).values({ email }).returning())?.[0]] =
				await this.db.select().from(voters).where(eq(voters.email, email)).limit(1);
			const [existingAssociation] = await this.db
				.select()
				.from(ballotVoters)
				.where(
					and(eq(ballotVoters.ballot_id, ballotId), eq(ballotVoters.voter_id, existingVoter.id))
				)
				.limit(1);
			if (!existingAssociation) {
				await this.db
					.insert(ballotVoters)
					.values({ ballot_id: ballotId, voter_id: existingVoter.id });
			}
		}
	}

	async removeVoterFromBallot(ballotId: string, voterId: string) {
		await this.db
			.delete(ballotVoters)
			.where(and(eq(ballotVoters.ballot_id, ballotId), eq(ballotVoters.voter_id, voterId)));
	}

	async getBallotVoters(ballotId: string) {
		// Get individual voters directly assigned to ballot
		const allVoters = await this.db
			.select({
				id: voters.id,
				email: voters.email,
				name: voters.name,
				user_id: voters.user_id
			})
			.from(voters)
			.innerJoin(ballotVoters, eq(ballotVoters.voter_id, voters.id))
			.where(eq(ballotVoters.ballot_id, ballotId));

		return allVoters;
	}
}
