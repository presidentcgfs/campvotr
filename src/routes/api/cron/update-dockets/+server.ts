import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NotificationManager } from '$lib/server/notifications';
import { handleError } from '$lib/server/middleware';

export const POST: RequestHandler = async (event) => {
	try {
		// In production, you'd want to secure this endpoint
		// For example, check for a secret token or restrict to specific IPs

		await NotificationManager.updateBallotStatuses();
		await NotificationManager.sendVotingReminders();

		return json({ message: 'Ballot statuses updated successfully' });
	} catch (error) {
		return handleError(error);
	}
};
