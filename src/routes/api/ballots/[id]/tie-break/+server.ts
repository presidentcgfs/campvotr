import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/server/middleware';
import { BallotService } from '$lib/db/queries';
import { db } from '$lib/db';
import { ballots } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const bodySchema = z.object({
	vote_choice: z.enum(['yea', 'nay', 'abstain']),
	note: z.string().max(1000).optional()
});

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const id = event.params.id!;
		const body = await event.request.json();
		const data = bodySchema.parse(body);

		const [b] = await db.select().from(ballots).where(eq(ballots.id, id)).limit(1);
		if (!b) return json({ error: 'Not found' }, { status: 404 });

		const now = new Date();
		const closed = now > new Date(b.voting_closes_at) || b.status === 'closed';
		if (!closed) return json({ error: 'Ballot is not closed' }, { status: 400 });

		const effective = await BallotService.getEffectiveTieBreakerUserId(id);
		if (!effective || effective !== user.id) return json({ error: 'Forbidden' }, { status: 403 });

		const tie = await BallotService.calculateTieStatus(id);
		if (!tie.isTie) return json({ error: 'No tie to resolve' }, { status: 409 });

		if (!tie.tiedChoices.includes(data.vote_choice))
			return json({ error: 'Choice is not in tied set' }, { status: 400 });

		// Ensure not already resolved
		if ((b as any).tie_break_resolved_at)
			return json({ error: 'Already resolved' }, { status: 409 });

		const ip =
			event.getClientAddress?.() ?? event.request.headers.get('x-forwarded-for') ?? undefined;
		await BallotService.recordTieBreakerVote({
			ballotId: id,
			userId: user.id,
			vote_choice: data.vote_choice,
			note: data.note,
			ip
		});

		const updatedCounts = await BallotService.getVoteCounts(id);

		return json({ ok: true, vote_counts: updatedCounts });
	});
