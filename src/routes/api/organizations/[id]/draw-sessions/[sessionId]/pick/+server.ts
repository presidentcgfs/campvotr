import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { pickServiceKey } from '$lib/services/pick-service';

const bodySchema = z.object({ timeSlotId: z.string().uuid() });

export const POST: RequestHandler = async (event) =>
  withAuth(event, async (event, user) => {
    const orgId = event.params.id!;
    const sessionId = event.params.sessionId!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgMembershipForId(event, orgId);

    const body = await event.request.json();
    const data = bodySchema.parse(body);

    const svc = event.locals.resolve(pickServiceKey);
    try {
      const result = await svc.performPick({
        organizationId: orgId,
        sessionId,
        userId: user.id,
        timeSlotId: data.timeSlotId
      });
      return json({ ok: true, ...result }, { status: 201 });
    } catch (e: any) {
      if (e instanceof Response) return e;
      const msg = e?.message ?? 'Pick failed';
      const status = msg === 'Not your turn' ? 422 : 400;
      return json({ error: msg }, { status });
    }
  });

