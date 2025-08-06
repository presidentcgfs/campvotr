import { db, ballots, votes, notifications, voteEvents } from './index';
import { voters, voterListMembers, ballotVoters } from './schema';
import { eq, and, desc, sql, count, or, inArray } from 'drizzle-orm';
import type { VoteChoice, BallotStatus, VoteCounts } from '../types';
import { emailService } from '$lib/server/email.svelte';

function canAccessQuery(userId: string) {
	return or(eq(ballotVoters.voter_id, userId), eq(ballots.creator_id, userId));
}
export class BallotService {
	static async createBallot(data: {
		title: string;
		description: string;
		creator_id: string;
		voting_opens_at: Date;
		voting_closes_at: Date;
		voting_threshold?: 'simple_majority' | 'supermajority' | 'unanimous' | 'custom';
		threshold_percentage?: number;
		quorum_required?: number;
		voter_list_id?: string;
		voter_emails?: string[];
		google_group_id?: string;
	}) {
		const [ballot] = await db
			.insert(ballots)
			.values({
				title: data.title,
				description: data.description,
				creator_id: data.creator_id,
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
					await db
						.select()
						.from(voterListMembers)
						.innerJoin(voters, eq(voterListMembers.voter_id, voters.id))
						.where(eq(voterListMembers.voter_list_id, data.voter_list_id))
				).map((v) => v.voters.email)
			);
		}

		if (emails.length) {
			const voterRecords = [];
			for (const email of emails) {
				// Check if voter already exists
				const [existingVoter = (await db.insert(voters).values({ email }).returning())?.[0]] =
					await db.select().from(voters).where(eq(voters.email, email)).limit(1);

				voterRecords.push(existingVoter);
			}

			// Add voters directly to the ballot
			const ballotVoterInserts = voterRecords.map((voter) => ({
				ballot_id: ballot.id,
				voter_id: voter.id
			}));

			await db.insert(ballotVoters).values(ballotVoterInserts);
		}

		return ballot;
	}

	static async getBallots(userId: string) {
		// Get ballots where user is eligible to vote
		// Either through voter list membership or direct ballot voter assignment

		const eligibleBallots = await db
			.selectDistinctOn([ballots.id, ballots.created_at])
			.from(ballots)

			.leftJoin(ballotVoters, and(eq(ballots.id, ballotVoters.ballot_id)))
			.where(canAccessQuery(userId))
			.orderBy(desc(ballots.created_at));

		return eligibleBallots.flatMap((v) => v.ballots);
	}

	static async getBallot(id: string, userId: string) {
		const [ballot] = await db
			.select()
			.from(ballots)
			.leftJoin(ballotVoters, and(eq(ballots.id, ballotVoters.ballot_id)))
			.where(canAccessQuery(userId))
			.limit(1);

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
			...ballot.ballots,
			vote_counts: voteCounts,
			user_vote: userVote,
			votes: allVotes,
			passing_status: passingStatus
		};
	}

	static async isUserEligibleForBallot(ballotId: string, userId: string): Promise<boolean> {
		const [dv] = await db
			.select()
			.from(ballotVoters)
			.where(and(eq(ballotVoters.ballot_id, ballotId), eq(ballotVoters.voter_id, userId)))
			.limit(1);
		return dv != null;
	}

	static async getVoteCounts(ballotId: string): Promise<VoteCounts> {
		const result = await db
			.select({
				vote_choice: votes.vote_choice,
				count: count()
			})
			.from(votes)
			.where(eq(votes.ballot_id, ballotId))
			.groupBy(votes.vote_choice);

		const counts = result.reduce(
			(ret, row) => {
				ret[row.vote_choice] = row.count;
				ret.total += row.count;
				return ret;
			},
			{
				yea: 0,
				nay: 0,
				abstain: 0,
				total: 0
			}
		);

		return counts;
	}

	static async getBallotVotes(ballotId: string) {
		return await db
			.select()
			.from(votes)
			.where(eq(votes.ballot_id, ballotId))
			.orderBy(desc(votes.voted_at));
	}

	static async getUserVote(ballotId: string, userId: string) {
		const [userVote] = await db
			.select()
			.from(votes)
			.leftJoin(voters, eq(votes.voter_id, voters.id))
			.where(and(eq(votes.ballot_id, ballotId), eq(voters.user_id, userId)))
			.limit(1);
		return userVote?.votes;
	}

	static async getUserVoteByVoterId(ballotId: string, voterId: string) {
		const [vote] = await db
			.select()
			.from(votes)
			.where(and(eq(votes.ballot_id, ballotId), eq(votes.voter_id, voterId)))
			.limit(1);

		return vote;
	}

	static async updateBallotStatus(id: string, status: BallotStatus) {
		const [ballot] = await db.update(ballots).set({ status }).where(eq(ballots.id, id)).returning();

		return ballot;
	}

	static async openVoting(id: string, data: { voting_opens_at: Date; voting_closes_at: Date }) {
		const [ballot] = await db
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
	static async sendVoterInvitations(ballotId: string) {
		try {
			const ballot = await this.getBallot(ballotId, '');
			// Get all voters for this ballot
			const voters = await this.getBallotVoters(ballotId);

			if (!ballot || !voters?.length) {
				return;
			}

			// Prepare invitation data
			const invitations = voters.map((voter) => ({
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
			const successCount = await emailService.sendBulkVoterInvitations(invitations);
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
	static async getBallotPassingStatus(ballotId: string) {
		const [ballot] = await db.select().from(ballots).where(eq(ballots.id, ballotId));
		if (!ballot) throw new Error('Ballot not found');

		const [voteCounts, totalEligibleVoters] = await Promise.all([
			this.getVoteCounts(ballotId),
			this.getTotalEligibleVoters(ballotId)
		]);

		const requiredVotes = this.calculateRequiredVotes(
			totalEligibleVoters,
			ballot.voting_threshold,
			ballot.threshold_percentage ? parseFloat(ballot.threshold_percentage) : undefined
		);

		const thresholdPercentage = this.getThresholdPercentage(
			ballot.voting_threshold,
			ballot.threshold_percentage ? parseFloat(ballot.threshold_percentage) : undefined
		);

		const totalVotes = voteCounts.yea + voteCounts.nay + voteCounts.abstain;
		const yeaPercentage =
			totalEligibleVoters > 0 ? (voteCounts.yea / totalEligibleVoters) * 100 : 0;

		// Check quorum requirements
		const quorumRequired = ballot.quorum_required;
		const quorumMet = quorumRequired ? totalVotes >= quorumRequired : true;
		const quorumNeeded = quorumRequired ? Math.max(0, quorumRequired - totalVotes) : undefined;

		// A ballot passes if it meets both the voting threshold AND quorum (if required)
		const meetsThreshold = voteCounts.yea >= requiredVotes;
		const isPassing = meetsThreshold && quorumMet;

		return {
			is_passing: isPassing,
			votes_needed: Math.max(0, requiredVotes - voteCounts.yea),
			required_votes: requiredVotes,
			total_eligible_voters: totalEligibleVoters,
			threshold_percentage: thresholdPercentage,
			current_percentage: yeaPercentage,
			total_votes_cast: totalVotes,
			vote_counts: voteCounts,
			quorum_required: quorumRequired,
			quorum_met: quorumMet,
			quorum_needed: quorumNeeded
		};
	}

	/**
	 * Get total number of eligible voters for a ballot
	 */
	static async getTotalEligibleVoters(ballotId: string): Promise<number> {
		// Count direct ballot voters
		const [{ total = 0 }] = await db
			.select({ total: count() })
			.from(ballotVoters)
			.where(eq(ballotVoters.ballot_id, ballotId))
			.limit(1);

		return total;
	}

	static async getBallotVoters(ballotId: string) {
		// Get individual voters directly assigned to ballot
		const allVoters = await db
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

export class VoteService {
	static async castVote(data: { ballot_id: string; user_id: string; vote_choice: VoteChoice }) {
		// Get voter record for this user
		const [userVoter] = await db
			.select()
			.from(voters)
			.where(eq(voters.user_id, data.user_id))
			.limit(1);

		if (!userVoter) {
			throw new Error('User is not registered as a voter');
		}

		// Check if user already voted
		const existingVote = await BallotService.getUserVoteByVoterId(data.ballot_id, userVoter.id);

		if (existingVote) {
			// One-and-done: do not allow updates here; the API layer enforces 409
			return existingVote;
		} else {
			// Create new vote
			const [vote] = await db
				.insert(votes)
				.values({
					ballot_id: data.ballot_id,
					voter_id: userVoter.id,
					vote_choice: data.vote_choice
				})
				.returning();

			// Record audit event for user cast
			await AdminVoteService.recordVoteEvent({
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

export class AdminVoteService {
	static async retrieveBallotVotesForAdmin(ballotId: string) {
		// Fetch votes and enrich with last audit info
		const allVotes = await BallotService.getBallotVotes(ballotId);
		const voteCounts = await BallotService.getVoteCounts(ballotId);

		// Get last event per voter
		const lastEvents = await db
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
				last_set_by_role: evt?.actor_role ?? 'user',
				last_set_at: evt?.created_at ?? v.updated_at
			};
		});

		return { votes: enriched, vote_counts: voteCounts };
	}

	static async recordVoteEvent(data: {
		ballot_id: string;
		voter_id: string;
		actor_user_id: string;
		actor_role: 'admin' | 'owner' | 'user';
		event_type: 'cast' | 'override' | 'clear';
		previous_choice: VoteChoice | null;
		new_choice: VoteChoice | null;
		reason?: string;
	}) {
		await db.insert(voteEvents).values({
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

	static async updateVoteByAdmin(params: {
		ballot_id: string;
		voter_id: string;
		new_choice: VoteChoice;
		reason?: string;
		actor_user_id: string;
		actor_role: 'admin' | 'owner';
	}) {
		const existing = await BallotService.getUserVoteByVoterId(params.ballot_id, params.voter_id);
		if (!existing) {
			const [vote] = await db
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

		const [updated] = await db
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

export class NotificationService {
	static async createNotification(data: {
		user_id: string;
		ballot_id?: string;
		type: 'new_ballot' | 'voting_reminder' | 'voting_closed' | 'voting_opened';
		message: string;
	}) {
		const [notification] = await db.insert(notifications).values(data).returning();

		return notification;
	}

	static async getUserNotifications(userId: string) {
		return await db
			.select()
			.from(notifications)
			.where(eq(notifications.user_id, userId))
			.orderBy(desc(notifications.sent_at));
	}

	static async markAsRead(id: string) {
		const [notification] = await db
			.update(notifications)
			.set({ read_at: new Date() })
			.where(eq(notifications.id, id))
			.returning();

		return notification;
	}

	static async notifyVotingOpened(ballotId: string) {
		// Get ballot details
		const [ballot] = await db.select().from(ballots).where(eq(ballots.id, ballotId));
		if (!ballot) return;

		// Get all eligible voters for this ballot
		const eligibleVoters = await BallotService.getBallotVoters(ballotId);

		// Create notifications for all eligible voters who have user accounts
		const notificationData = eligibleVoters
			.filter((voter) => voter.user_id) // Only notify users with accounts
			.map((voter) => ({
				user_id: voter.user_id!,
				ballot_id: ballotId,
				type: 'voting_opened' as const,
				message: `Voting has opened for "${ballot.title}". Cast your vote before ${new Date(ballot.voting_closes_at).toLocaleString()}.`
			}));

		if (notificationData.length > 0) {
			await db.insert(notifications).values(notificationData);
		}

		return notificationData.length;
	}
}
