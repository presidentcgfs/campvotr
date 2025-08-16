import { ballots, notifications } from '../db/index';
import { eq, desc } from 'drizzle-orm';
import { ballotServiceKey } from './ballot-service';
import { drizzleKey } from '../db/pbj';
import { pbj, pbjKey } from '@pbinj/pbj';

export const notificationServiceKey = pbjKey<NotificationService>('notificationService');
export class NotificationService {
	constructor(
		private db = pbj(drizzleKey),
		private ballotService = pbj(ballotServiceKey)
	) {}
	async createNotification(data: {
		user_id: string;
		ballot_id?: string;
		type: 'new_ballot' | 'voting_reminder' | 'voting_closed' | 'voting_opened';
		message: string;
	}) {
		const [notification] = await this.db.insert(notifications).values(data).returning();

		return notification;
	}

	async getUserNotifications(userId: string) {
		return await this.db
			.select()
			.from(notifications)
			.where(eq(notifications.user_id, userId))
			.orderBy(desc(notifications.sent_at));
	}

	async markAsRead(id: string) {
		const [notification] = await this.db
			.update(notifications)
			.set({ read_at: new Date() })
			.where(eq(notifications.id, id))
			.returning();

		return notification;
	}

	async notifyVotingOpened(ballotId: string) {
		// Get ballot details
		const [ballot] = await this.db.select().from(ballots).where(eq(ballots.id, ballotId));
		if (!ballot) return;

		// Get all eligible voters for this ballot
		const eligibleVoters = await this.ballotService.getBallotVoters(ballotId);

		// Create notifications for all eligible voters who have user accounts
		const notificationData = eligibleVoters
			.filter((voter) => voter.user_id) // Only notify users with accounts
			.map((voter) => ({
				user_id: voter.user_id!,
				ballot_id: ballotId,
				type: 'voting_opened' as const,
				message: `Voting has opened for "${(ballot as any).title}". Cast your vote before ${new Date((ballot as any).voting_closes_at).toLocaleString()}.`
			}));

		if (notificationData.length > 0) {
			await this.db.insert(notifications).values(notificationData);
		}

		return notificationData.length;
	}
}
