import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';

const actionSchema = z.enum(['start', 'pause', 'resume', 'cancel']);

export const POST: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const sessionId = event.params.sessionId!;
    const action = actionSchema.parse(event.params.action);

    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgRoleForId(event, orgId, ['OWNER', 'ADMIN']);

    const svc = event.locals.resolve(drawSessionServiceKey);
    const status =
      action === 'start' ? 'active' : action === 'pause' ? 'paused' : action === 'resume' ? 'active' : 'cancelled';

    const updated = await svc.updateStatus(orgId, sessionId, status as any);
    if (!updated) return json({ error: 'Not found' }, { status: 404 });

    return json({ drawSession: updated });
  });

