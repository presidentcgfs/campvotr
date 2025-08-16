import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { organizationServiceKey } from '$lib/services/org';
import { withAuth } from '$lib/services/middleware';

const roleSchema = z.object({ role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'MEMBER', 'VIEWER']) });

export const PATCH: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = event.params.id!;
		const userId = event.params.userId!;
		const orgSvc = event.locals.resolve(organizationServiceKey);

		await orgSvc.requireOrgRoleForId(event, id, ['OWNER', 'ADMIN']);

		const body = await event.request.json();
		const data = roleSchema.parse(body);

		const org = await orgSvc.fetchOrganization(id);
		if (!org) return json({ error: 'Not found' }, { status: 404 });

		// prevent demoting last OWNER (handled in service)
		const member = await orgSvc.updateRole(id, userId, data.role);
		if (!member) return json({ error: 'Member not found' }, { status: 404 });

		return json({ member });
	});

export const DELETE: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = event.params.id!;
		const userId = event.params.userId!;
		const orgSvc = event.locals.resolve(organizationServiceKey);

		await orgSvc.requireOrgRoleForId(event, id, ['OWNER', 'ADMIN']);

		const org = await orgSvc.fetchOrganization(id);
		if (!org) return json({ error: 'Not found' }, { status: 404 });

		const result = await orgSvc.deleteMember(id, userId);

		if (!result.success) {
			if (result.error === 'Member not found') {
				return json({ error: result.error }, { status: 404 });
			}
			if (result.error === 'Cannot remove the last OWNER') {
				return json({ error: result.error }, { status: 422 });
			}
			return json({ error: result.error }, { status: 400 });
		}

		return json({ ok: true });
	});
