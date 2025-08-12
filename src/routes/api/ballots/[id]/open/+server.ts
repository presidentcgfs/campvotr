import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BallotService, NotificationService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';
import { updateBallotStatusSchema, openVotingSchema, idSchema } from '$lib/validation';

export const POST: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const { id } = idSchema.parse(event.params);
			const body =
				event.request.headers.get('content-type') === 'application/json'
					? await event.request.json()
					: Object.fromEntries(await event.request.formData());

			// Check if user is the creator of the ballot
			const existingBallot = await BallotService.getBallot(id, user.id);
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

			const validatedData = openVotingSchema.parse(body);
			const ballot = await BallotService.openVoting(id, {
				voting_opens_at: validatedData.voting_opens_at,
				voting_closes_at: validatedData.voting_closes_at
			});

			// Send notifications to voters if requested
			if (validatedData.send_notifications) {
				try {
					await NotificationService.notifyVotingOpened(id);
				} catch (error) {
					console.error('Failed to send voting opened notifications:', error);
					// Don't fail the request if notifications fail
				}
			}

			return json({ ballot, success: true });
		});
	} catch (error) {
		return handleError(error);
	}
};
