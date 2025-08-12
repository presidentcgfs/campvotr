import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BallotService, NotificationService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';

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
