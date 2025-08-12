import { BallotService } from '$lib/db/queries';
import { json } from 'zod';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}
	const orgId = locals.organizationContext?.organization?.id;
	const ballots = await BallotService.getBallots(locals.user?.id, orgId);
	const openBallots = ballots.filter((d) => d.status === 'open');
	const recentBallots = ballots.filter((d) => d.status !== 'draft').slice(0, 5);

	return { openBallots, recentBallots, totalBallots: ballots.length };
};
