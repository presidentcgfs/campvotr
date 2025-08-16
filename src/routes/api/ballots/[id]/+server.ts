import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { idSchema } from '$lib/validation';

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const { id } = idSchema.parse(event.params);
		const ballot = await event.locals.resolve(ballotServiceKey).getBallot(id, user.id);

		if (!ballot) {
			return json({ error: 'Ballot not found' }, { status: 404 });
		}

		return json({ ballot });
	});
