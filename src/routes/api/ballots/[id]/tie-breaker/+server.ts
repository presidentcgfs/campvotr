import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/server/middleware';
import { BallotService } from '$lib/db/queries';
import { db } from '$lib/db';
import { ballots } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (event, user) => {
    const id = event.params.id!;
    const [b] = await db.select().from(ballots).where(eq(ballots.id, id)).limit(1);
    if (!b) return json({ error: 'Not found' }, { status: 404 });

    const designated = await BallotService.getEffectiveTieBreakerUserId(id);
    const tie = await BallotService.calculateTieStatus(id);

    const now = new Date();
    const closed = now > new Date(b.voting_closes_at) || b.status === 'closed';
    const canAct = !!designated && closed && tie.isTie && !(b as any).tie_break_resolved_at && designated === (event.locals as any).user.id;

    return json({
      designated_user_id: designated,
      overridden: !!(b as any).tie_breaker_user_id,
      is_closed: closed,
      tie_status: tie,
      can_act: canAct
    });
  });

