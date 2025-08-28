import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { fieldServiceKey } from '$lib/services/field-service';

const createSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  capacity: z.number().int().min(1).optional(),
  active: z.boolean().optional()
});

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgMembershipForId(event, orgId);

    const fieldSvc = event.locals.resolve(fieldServiceKey);
    const rows = await fieldSvc.listFields(orgId);
    return json({ fields: rows });
  });

export const POST: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgRoleForId(event, orgId, ['OWNER', 'ADMIN', 'EDITOR']);

    const body = await event.request.json();
    const data = createSchema.parse(body);

    const fieldSvc = event.locals.resolve(fieldServiceKey);
    const row = await fieldSvc.createField({ organizationId: orgId, ...data });
    return json({ field: row }, { status: 201 });
  });

