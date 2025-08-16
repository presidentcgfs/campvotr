import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { idSchema } from '$lib/validation';
import { ballotServiceKey } from '$lib/services/ballot-service';

const bodySchema = z.object({
	vote_choice: z.enum(['yea', 'nay', 'abstain']),
	note: z.string().max(1000).optional()
});

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const id = idSchema.parse(event.params.id).id;
		const body = await event.request.json();
		const data = bodySchema.parse(body);
		const ballotService = event.locals.resolve(ballotServiceKey);
		const b = await ballotService.getBallot(id, user.id);
		if (!b) return json({ error: 'Not found' }, { status: 404 });

		const now = new Date();
		const closed = now > b.voting_closes_at || b.status === 'closed';
		if (!closed) return json({ error: 'Ballot is not closed' }, { status: 400 });

		const effective = await ballotService.getEffectiveTieBreakerUserId(id);
		if (!effective || effective !== user.id) return json({ error: 'Forbidden' }, { status: 403 });

		const tie = await ballotService.calculateTieStatus(id);
		if (!tie.isTie) return json({ error: 'No tie to resolve' }, { status: 409 });

		if (!tie.tiedChoices.includes(data.vote_choice))
			return json({ error: 'Choice is not in tied set' }, { status: 400 });

		// Ensure not already resolved
		if ((b as any).tie_break_resolved_at)
			return json({ error: 'Already resolved' }, { status: 409 });

		const ip =
			event.getClientAddress?.() ?? event.request.headers.get('x-forwarded-for') ?? undefined;
		await ballotService.recordTieBreakerVote({
			ballotId: id,
			userId: user.id,
			vote_choice: data.vote_choice,
			note: data.note,
			ip
		});

		const updatedCounts = await ballotService.getVoteCounts(id);

		return json({ ok: true, vote_counts: updatedCounts });
	});
