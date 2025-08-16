import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { createBallotSchema } from '$lib/validation';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { parseResponse } from '$lib/utils/parse';

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const orgId = event.locals.organizationContext?.organization?.id;
		const ballotService = event.locals.resolve(ballotServiceKey);
		const ballots = await ballotService.getBallots(user.id, orgId);
		return json({ ballots });
	});

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const validatedData = await parseResponse(createBallotSchema, event.request);
		const orgId = event.locals.organizationContext?.organization?.id;
		if (!orgId) return json({ error: 'Organization context required' }, { status: 400 });

		const ballotService = event.locals.resolve(ballotServiceKey);

		const ballot = await ballotService.createBallot({
			...validatedData,
			creator_id: user.id,
			organization_id: orgId,
			voting_opens_at: new Date(validatedData.voting_opens_at),
			voting_closes_at: new Date(validatedData.voting_closes_at),
			voting_threshold: validatedData.voting_threshold,
			threshold_percentage: validatedData.threshold_percentage,
			quorum_required: validatedData.quorum_required
		});

		return json({ ballot }, { status: 201 });
	});
