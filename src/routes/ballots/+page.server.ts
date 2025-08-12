import { BallotService } from '$lib/db/queries';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.session) {
		throw redirect(303, `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}
	const ballots = await BallotService.getBallots(
		locals.user!.id,
		locals.organizationContext?.organization?.id
	);
	return {
		ballots,
		canCreateBallot: locals.user?.role === 'admin'
	};
};
