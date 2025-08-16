import { ballotServiceKey } from '$lib/services/ballot-service';
import { withAuthRedirect } from '$lib/services/middleware';
import type { PageServerLoad } from './$types';

export const load = withAuthRedirect<PageServerLoad>(async ({ locals }) => {
	const ballots = await locals
		.resolve(ballotServiceKey)
		.getBallots(locals.user!.id, locals.organizationContext?.organization?.id);
	return {
		ballots,
		canCreateBallot: locals.user?.role === 'admin'
	};
});
