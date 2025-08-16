import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { authorizationServiceKey } from '$lib/services/authorization';
import { adminVoteServiceKey } from '$lib/services/vote.admin-service';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { z } from 'zod';
import { parseResponse } from '$lib/utils/parse';

const bodySchema = z.object({
	vote_choice: z.enum(['yea', 'nay', 'abstain']),
	reason: z.string().max(500).optional(),
	notify_user: z.boolean().optional().default(false)
});

const idSchema = z.object({
	id: z.string().uuid(),
	voter_id: z.string().uuid()
});

export const PATCH: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const { id: ballotId, voter_id: voterId } = idSchema.parse(event.params);

		const ballotService = event.locals.resolve(ballotServiceKey);
		const adminVotes = event.locals.resolve(adminVoteServiceKey);
		const authz = event.locals.resolve(authorizationServiceKey);

		const ballot = await ballotService.getBallot(ballotId, user.id);
		if (!ballot) return json({ error: 'Ballot not found' }, { status: 404 });

		const actorRole = await authz.verifyBallotAdminAccess(event, ballotId, user.id);
		if (!actorRole) return json({ error: 'Forbidden' }, { status: 403 });

		const parsed = await parseResponse(bodySchema, event.request);

		const vote = await adminVotes.updateVoteByAdmin({
			ballot_id: ballotId,
			voter_id: voterId,
			new_choice: parsed.vote_choice,
			reason: parsed.reason,
			actor_user_id: user.id,
			actor_role: actorRole
		});

		const vote_counts = await ballotService.getVoteCounts(ballotId);
		return json({ vote, vote_counts });
	});

// DELETE /api/ballots/[id]/voters/[voter_id] - Remove a voter from a ballot
export const DELETE: RequestHandler = async (event) =>
	withAuth(event, async ({ params, locals }, user) => {
		const { id: ballotId, voter_id: voterId } = idSchema.parse(params);
		if (!voterId) {
			return json({ error: 'voter_id parameter is required' }, { status: 400 });
		}
		const ballotService = locals.resolve(ballotServiceKey);
		const ballot = await ballotService.getBallot(ballotId, user.id);
		if (!ballot) return json({ error: 'Ballot not found' }, { status: 404 });
		await ballotService.removeVoterFromBallot(ballotId, voterId);
		return json({ message: 'Voter removed from ballot successfully' });
	});
