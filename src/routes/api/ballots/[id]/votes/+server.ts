import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AdminVoteService, BallotService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';
import { verifyBallotAdminAccess } from '$lib/server/authorization';
import { idSchema } from '$lib/validation';

export const GET: RequestHandler = (event) =>
	withAuth(event, async (event, user) => {
		const { id: ballotId } = idSchema.parse(event.params);

		// Check if ballot exists
		const ballot = await BallotService.getBallot(ballotId, user.id);
		if (!ballot) {
			return json({ error: 'Ballot not found' }, { status: 404 });
		}

		const role = await verifyBallotAdminAccess(event, ballotId, user.id);
		if (!role) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const { votes, vote_counts } = await AdminVoteService.retrieveBallotVotesForAdmin(ballotId);

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
