import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/services/middleware';
import { fieldServiceKey } from '$lib/services/field-service';

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (evt) => {
    const orgId = evt.locals.organizationContext?.organization?.id;
    if (!orgId) return json({ fields: [] }, { status: 200 });
    const fsvc = evt.locals.resolve(fieldServiceKey);
    const fields = await fsvc.listFields(orgId);
    return json({ fields });
  });

