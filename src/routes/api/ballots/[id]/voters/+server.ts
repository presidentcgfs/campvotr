import { json } from '@sveltejs/kit';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/services/middleware';
import { idSchema } from '$lib/validation';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { parseResponse } from '$lib/utils/parse';

const addVotersSchema = z.object({
	voter_emails: z
		.array(z.string().email('Invalid email'))
		.min(1, 'At least one voter email is required')
});

// GET /api/ballots/[id]/voters - Get voters for a specific ballot
export const GET: RequestHandler = async (event) =>
	withAuth(event, async ({ params, locals }, user) => {
		try {
			if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
			const ballotId = idSchema.parse(params).id;
			const ballotService = locals.resolve(ballotServiceKey);
			const ballot = await ballotService.getBallot(ballotId, user.id);
			if (!ballot) return json({ error: 'Ballot not found' }, { status: 404 });
			const voters = await ballotService.getBallotVoters(ballotId);
			return json({ voters });
		} catch (error) {
			console.error('Error fetching ballot voters:', error);
			return json({ error: 'Internal server error' }, { status: 500 });
		}
	});

// POST /api/ballots/[id]/voters - Add voters to a ballot
export const POST: RequestHandler = (event) =>
	withAuth(event, async ({ params, request, locals }, user) => {
		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		const ballotId = idSchema.parse(params).id;
		const validatedData = await parseResponse(addVotersSchema, request);
		const ballotService = locals.resolve(ballotServiceKey);
		const ballot = await ballotService.getBallot(ballotId, user.id);

		if (!ballot) return json({ error: 'Ballot not found' }, { status: 404 });

		await ballotService.addVotersToBallot(ballotId, validatedData.voter_emails);

		return json(
			{ message: `Added voters`, addedVoters: validatedData.voter_emails.length },
			{ status: 201 }
		);
	});

const deleteSchema = z.object({
	voter_id: z.uuid(),
	id: z.uuid()
});
