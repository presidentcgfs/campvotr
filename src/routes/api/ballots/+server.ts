import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BallotService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';
import { createBallotSchema } from '$lib/validation';
import { EmailService } from '$lib/server/email';

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const orgId = (event.locals as any).organizationContext?.organization?.id;
		const ballots = await BallotService.getBallots(user.id, orgId);
		return json({ ballots });
	});

export const POST: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const body = await event.request.json();
			const validatedData = createBallotSchema.parse(body);
			const orgId = (event.locals as any).organizationContext?.organization?.id;
			if (!orgId) return json({ error: 'Organization context required' }, { status: 400 });
			const ballot = await BallotService.createBallot({
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
	} catch (error) {
		return handleError(error);
	}
};
