import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/utils/authorize';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { withAuthRedirect } from '$lib/services/middleware';

export const load = withAuthRedirect<PageServerLoad>(
	async ({ locals: { user, organizationContext, resolve } }) => {
		const orgId = organizationContext?.organization?.id;
		const ballots = await resolve(ballotServiceKey).getBallots(user!.id, orgId);
		const openBallots = ballots.filter(({ status }) => status === 'open');
		const recentBallots = ballots.filter(({ status }) => status !== 'draft').slice(0, 5);
		const canCreateBallot = isAdmin(user);
		return { canCreateBallot, openBallots, recentBallots, totalBallots: ballots.length };
	}
);
