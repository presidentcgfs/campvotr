import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { authorizationServiceKey } from '$lib/services/authorization';
import { adminVoteServiceKey } from '$lib/services/vote.admin-service';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { idSchema } from '$lib/validation';

export const GET: RequestHandler = (event) =>
	withAuth(event, async (event, user) => {
		const { id: ballotId } = idSchema.parse(event.params);

		const ballotService = event.locals.resolve(ballotServiceKey);
		const ballot = await ballotService.getBallot(ballotId, user.id);
		if (!ballot) {
			return json({ error: 'Ballot not found' }, { status: 404 });
		}

		const authz = event.locals.resolve(authorizationServiceKey);
		const role = await authz.verifyBallotAdminAccess(event, ballotId, user.id);
		if (!role) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const adminVotes = event.locals.resolve(adminVoteServiceKey);
		const { votes, vote_counts } = await adminVotes.retrieveBallotVotesForAdmin(ballotId);

		return json({
			votes,
			vote_counts,
			ballot: {
				id: ballot.id,
				title: ballot.title,
				status: ballot.status,
				voting_opens_at: ballot.voting_opens_at,
				voting_closes_at: ballot.voting_closes_at,
				quorum_required: ballot.quorum_required
			}
		});
	});
