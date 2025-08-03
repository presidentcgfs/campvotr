import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/server/middleware';
import { AdminVoteService, BallotService } from '$lib/db/queries';
import { verifyBallotAdminAccess } from '$lib/server/authorization';
import { z } from 'zod';

const bodySchema = z.object({
  vote_choice: z.enum(['yea', 'nay', 'abstain']),
  reason: z.string().max(500).optional(),
  notify_user: z.boolean().optional().default(false)
});

export const PATCH: RequestHandler = async (event) => {
  try {
    return await withAuth(event, async (event, user) => {
      const ballotId = event.params.id;
      const voterId = event.params.voter_id;

      const ballot = await BallotService.getBallot(ballotId, user.id);
      if (!ballot) return json({ error: 'Ballot not found' }, { status: 404 });

      const actorRole = await verifyBallotAdminAccess(event, ballotId, user.id);
      if (!actorRole) return json({ error: 'Forbidden' }, { status: 403 });

      const raw = await event.request.json();
      const parsed = bodySchema.safeParse(raw);
      if (!parsed.success) {
        return json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
      }

      const vote = await AdminVoteService.updateVoteByAdmin({
        ballot_id: ballotId,
        voter_id: voterId,
        new_choice: parsed.data.vote_choice,
        reason: parsed.data.reason,
        actor_user_id: user.id,
        actor_role: actorRole === 'owner' ? 'owner' : 'admin'
      });

      const vote_counts = await BallotService.getVoteCounts(ballotId);

      // TODO: optional notify_user email/notification here if desired

      return json({ vote, vote_counts });
    });
  } catch (error) {
    return handleError(error);
  }
};

