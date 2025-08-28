import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { fieldServiceKey } from '$lib/services/field-service';

const updateSchema = z.object({
  name: z.string().optional(),
  location: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  capacity: z.number().int().min(1).optional(),
  active: z.boolean().optional()
});

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const fieldId = event.params.fieldId!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgMembershipForId(event, orgId);

    const svc = event.locals.resolve(fieldServiceKey);
    const row = await svc.fetchField(orgId, fieldId);
    if (!row) return json({ error: 'Not found' }, { status: 404 });
    return json({ field: row });
  });

export const PUT: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const fieldId = event.params.fieldId!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgRoleForId(event, orgId, ['OWNER', 'ADMIN', 'EDITOR']);

    const body = await event.request.json();
    const patch = updateSchema.parse(body);

    const svc = event.locals.resolve(fieldServiceKey);
    const updated = await svc.updateField(orgId, fieldId, patch);
    if (!updated) return json({ error: 'Not found' }, { status: 404 });
    return json({ field: updated });
  });

export const DELETE: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const fieldId = event.params.fieldId!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgRoleForId(event, orgId, ['OWNER', 'ADMIN']);

    const svc = event.locals.resolve(fieldServiceKey);
    const deletedId = await svc.deleteField(orgId, fieldId);
    if (!deletedId) return json({ error: 'Not found' }, { status: 404 });
    return json({ id: deletedId });
  });

