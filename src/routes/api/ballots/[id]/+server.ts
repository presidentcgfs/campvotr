import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BallotService, NotificationService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';
import { updateBallotStatusSchema, openVotingSchema, idSchema } from '$lib/validation';

export const GET: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const { id } = event.params;
			if (!id) {
				return json({ error: 'Ballot id is required' }, { status: 400 });
			}
			const ballot = await BallotService.getBallot(id, user.id);

			if (!ballot) {
				return json({ error: 'Ballot not found' }, { status: 404 });
			}

			return json({ ballot });
		});
	} catch (error) {
		return handleError(error);
	}
};

export const PATCH: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const { id } = idSchema.parse(event.params);
			const body = await event.request.json();

			// Check if user is the creator of the ballot
			const existingBallot = await BallotService.getBallot(id, user.id);
			if (!existingBallot) {
				return json({ error: 'Ballot not found' }, { status: 404 });
			}

			if (existingBallot.creator_id !== user.id) {
				return json({ error: 'Forbidden' }, { status: 403 });
			}

			// Handle different types of updates
			if (body.action === 'open_voting') {
				// Validate that ballot is in draft status
				if (existingBallot.status !== 'draft') {
					return json({ error: 'Can only open voting for draft ballots' }, { status: 400 });
				}

				const validatedData = openVotingSchema.parse(body);
				const ballot = await BallotService.openVoting(id, {
					voting_opens_at: new Date(validatedData.voting_opens_at),
					voting_closes_at: new Date(validatedData.voting_closes_at)
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

				return json({ ballot });
			} else {
				// Handle status updates
				const validatedData = updateBallotStatusSchema.parse(body);
				const ballot = await BallotService.updateBallotStatus(id, validatedData.status);
				return json({ ballot });
			}
		});
	} catch (error) {
		return handleError(error);
	}
};
