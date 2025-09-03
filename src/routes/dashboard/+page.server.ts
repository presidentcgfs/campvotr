import type { PageServerLoad } from './$types';
import { isAdmin } from '$lib/utils/authorize';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { withAuthRedirect } from '$lib/services/middleware';

export const load = withAuthRedirect<PageServerLoad>(
	async ({ locals: { user, organizationContext, resolve } }) => {
		const orgId = organizationContext?.organization?.id;

		// Load ballots
		const ballots = await resolve(ballotServiceKey).getBallots(user!.id, orgId);
		const openBallots = ballots.filter(({ status }) => status === 'open');
		const recentBallots = ballots.filter(({ status }) => status !== 'draft').slice(0, 5);
		const canCreateBallot = isAdmin(user);

		// Load draw sessions
		let drawSessions: any[] = [];
		let openDrawSessions: any[] = [];
		if (orgId) {
			drawSessions = await resolve(drawSessionServiceKey).getUserSessions(
				orgId,
				user!.id,
				user!.email!
			);
			openDrawSessions = drawSessions.filter(({ status }) =>
				['active', 'scheduled'].includes(status)
			);
		}

		return {
			canCreateBallot,
			openBallots,
			recentBallots,
			totalBallots: ballots.length,
			drawSessions: drawSessions.slice(0, 5), // Show recent 5
			openDrawSessions,
			totalDrawSessions: drawSessions.length
		};
	}
);
