import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';

const createSchema = z.object({
  name: z.string().min(1),
  turnStrategy: z.enum(['fixed', 'randomized', 'snake']).default('fixed'),
  rounds: z.number().int().min(1).nullable().optional(),
  pickTimeoutSec: z.number().int().min(10).max(3600),
  startsAtUtc: z.string().datetime(),
  participants: z.array(z.object({ userId: z.string().uuid(), role: z.string().optional() })).min(1)
});

export const POST: RequestHandler = async (event) =>
  withAuth(event, async (event, user) => {
    const orgId = event.params.id!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgRoleForId(event, orgId, ['OWNER', 'ADMIN']);

    const body = await event.request.json();
    const data = createSchema.parse(body);

    const svc = event.locals.resolve(drawSessionServiceKey);
    const session = await svc.createSession({
      organizationId: orgId,
      name: data.name,
      turnStrategy: data.turnStrategy,
      rounds: data.rounds ?? null,
      pickTimeoutSec: data.pickTimeoutSec,
      startsAtUtc: new Date(data.startsAtUtc),
      createdByUserId: user.id,
      participants: data.participants
    });

    return json({ drawSession: session }, { status: 201 });
  });

