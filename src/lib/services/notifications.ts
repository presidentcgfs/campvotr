import { ballots } from '$lib/db';
import { eq, and, lte, gte } from 'drizzle-orm';
import { pbj, pbjKey } from '@pbinj/pbj';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { notificationServiceKey } from '$lib/services/notification-service';
import { drizzleKey } from '$lib/pbj';

export const notificationManagerKey = pbjKey<NotificationManager>('notificationManager');
export class NotificationManager {
	constructor(
		private db = pbj(drizzleKey),
		private ballotService = pbj(ballotServiceKey),
		private notificationService = pbj(notificationServiceKey)
	) {}

	// Create notification when a new ballot is created
	async notifyNewBallot(ballotId: string, creatorId: string) {
		try {
			const ballot = await this.ballotService.getBallot(ballotId, creatorId);
			if (!ballot) return;

			// For now, we'll just create a notification for the creator
			// In a real app, you might want to notify all users or specific groups
			await this.notificationService.createNotification({
				user_id: creatorId,
				ballot_id: ballotId,
				type: 'new_ballot',
				message: `Your ballot "${ballot.title}" has been created and is ready for voting.`
			});
		} catch (error) {
			console.error('Error creating new ballot notification:', error);
		}
	}

	// Send reminders for ballots that are about to close
	async sendVotingReminders() {
		try {
			const now = new Date();
			const reminderTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

			// Find ballots closing within 24 hours
			const closingBallots = await this.db
				.select()
				.from(ballots)
				.where(
					and(
						eq(ballots.status, 'open'),
						lte(ballots.voting_closes_at, reminderTime),
						gte(ballots.voting_closes_at, now)
					)
				);

			for (const ballot of closingBallots) {
				// Create reminder notification for the creator
				await this.notificationService.createNotification({
					user_id: ballot.creator_id,
					ballot_id: ballot.id,
					type: 'voting_reminder',
					message: `Voting for "${ballot.title}" will close soon. Voting ends at ${new Date(ballot.voting_closes_at).toLocaleString()}.`
				});
			}
		} catch (error) {
			console.error('Error sending voting reminders:', error);
		}
	}

	// Notify when voting has closed
	async notifyVotingClosed(ballotId: string) {
		try {
			const ballot = await this.ballotService.getBallot(ballotId, '');
			if (!ballot) return;

			const voteCounts = await this.ballotService.getVoteCounts(ballotId);
			const totalVotes = voteCounts.total;

			await this.notificationService.createNotification({
				user_id: ballot.creator_id,
				ballot_id: ballotId,
				type: 'voting_closed',
				message: `Voting for "${ballot.title}" has closed. Total votes: ${totalVotes} (Yea: ${voteCounts.yea}, Nay: ${voteCounts.nay}, Abstain: ${voteCounts.abstain}).`
			});
		} catch (error) {
			console.error('Error creating voting closed notification:', error);
		}
	}

	// Background job to check and update ballot statuses
	async updateBallotStatuses() {
		try {
			const now = new Date();

			// Open ballots that should be open
			const ballotsToOpen = await this.db
				.select()
				.from(ballots)
				.where(and(eq(ballots.status, 'draft'), lte(ballots.voting_opens_at, now)));

			for (const ballot of ballotsToOpen) {
				await this.ballotService.updateBallotStatus(ballot.id, 'open');
			}

			// Close ballots that should be closed
			const ballotsToClose = await this.db
				.select()
				.from(ballots)
				.where(and(eq(ballots.status, 'open'), lte(ballots.voting_closes_at, now)));

			for (const ballot of ballotsToClose) {
				await this.ballotService.updateBallotStatus(ballot.id, 'closed');
				await this.notifyVotingClosed(ballot.id);
			}
		} catch (error) {
			console.error('Error updating ballot statuses:', error);
		}
	}
}
