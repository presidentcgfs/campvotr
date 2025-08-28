import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const sessionId = event.params.sessionId!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgMembershipForId(event, orgId);

    const svc = event.locals.resolve(drawSessionServiceKey);
    const state = await svc.fetchSessionState(orgId, sessionId);
    if (!state) return json({ error: 'Not found' }, { status: 404 });
    return json({ ...state });
  });

