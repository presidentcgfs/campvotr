import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { openVotingSchema, idSchema } from '$lib/validation';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { notificationServiceKey } from '$lib/services/notification-service';
import { parseResponse } from '$lib/utils/parse';

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const ballotService = event.locals.resolve(ballotServiceKey);
		const notificationService = event.locals.resolve(notificationServiceKey);
		const { id } = idSchema.parse(event.params);
		const validatedData = await parseResponse(openVotingSchema, event.request);

		// Check if user is the creator of the ballot
		const existingBallot = await ballotService.getBallot(id, user.id);
		if (!existingBallot) {
			return json({ error: 'Ballot not found' }, { status: 404 });
		}

		if (existingBallot.creator_id !== user.id) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		// Handle different types of updates
		// Validate that ballot is in draft status
		if (existingBallot.status === 'closed') {
			return json({ error: 'Can only change for not closed ballots' }, { status: 400 });
		}

		const ballot = await ballotService.openVoting(id, validatedData);

		// Send notifications to voters if requested
		if (validatedData.send_notifications) {
			await notificationService.notifyVotingOpened(id);
		}

		return json({ ballot, success: true });
	});
