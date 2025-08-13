import { BallotService } from '$lib/db/queries';
import { json } from 'zod';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/utils/authorize';

export const load: PageServerLoad = async ({ locals: { user, organizationContext }, url }) => {
	if (!user) {
		throw redirect(303, `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}
	const orgId = organizationContext?.organization?.id;
	const ballots = await BallotService.getBallots(user.id, orgId);
	const openBallots = ballots.filter((d) => d.status === 'open');
	const recentBallots = ballots.filter((d) => d.status !== 'draft').slice(0, 5);
	const canCreateBallot = isAdmin(user);
	return { canCreateBallot, openBallots, recentBallots, totalBallots: ballots.length };
};
