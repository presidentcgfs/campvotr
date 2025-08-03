import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BallotService, VoteService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';
import { castVoteSchema, idSchema } from '$lib/validation';

export const POST: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const { id: ballotId } = idSchema.parse(event.params);

			const body = await event.request.json();
			const validatedData = castVoteSchema.parse(body);

			// Check if ballot exists and user is eligible to vote
			const ballot = await BallotService.getBallot(ballotId, user.id);
			if (!ballot) {
				return json({ error: 'Ballot not found or access denied' }, { status: 404 });
			}

			const now = new Date();
			const votingOpens = new Date(ballot.voting_opens_at);
			const votingCloses = new Date(ballot.voting_closes_at);

			if (now < votingOpens) {
				return json({ error: 'Voting has not started yet' }, { status: 400 });
			}

			if (now > votingCloses) {
				return json({ error: 'Voting has ended' }, { status: 400 });
			}

			if (ballot.status !== 'open') {
				return json({ error: 'Voting is not open for this ballot' }, { status: 400 });
			}

			// Enforce one-and-done voting: reject if the user has already voted on this ballot
			const existingVote = await BallotService.getUserVote(ballotId, user.id);
			if (existingVote) {
				return json(
					{ error: 'You have already voted on this ballot. Votes cannot be changed.' },
					{ status: 409 }
				);
			}

			const vote = await VoteService.castVote({
				ballot_id: ballotId,
				user_id: user.id,
				vote_choice: validatedData.vote_choice
			});

			// Get updated vote counts
			const voteCounts = await BallotService.getVoteCounts(ballotId);

			return json({ vote, vote_counts: voteCounts });
		});
	} catch (error) {
		return handleError(error);
	}
};
