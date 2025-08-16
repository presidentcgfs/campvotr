import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';

const bodySchema = z.object({
	userId: z.string().uuid().nullable().optional() // null to clear
});

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = event.params.id!;
		const orgSvc = event.locals.resolve(organizationServiceKey);

		await orgSvc.requireOrgRoleForId(event, id, ['OWNER', 'ADMIN']);

		const body = await event.request.json();
		const { userId } = bodySchema.parse(body);

		const org = await orgSvc.fetchOrganization(id);
		if (!org) return json({ error: 'Organization not found' }, { status: 404 });

		try {
			const updated = await orgSvc.setTieBreaker(id, userId ?? null);
			return json({ organization: updated });
		} catch (error: any) {
			return json({ error: error.message }, { status: 400 });
		}
	});

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = event.params.id!;
		const orgSvc = event.locals.resolve(organizationServiceKey);

		const org = await orgSvc.fetchOrganization(id);
		if (!org) return json({ error: 'Organization not found' }, { status: 404 });

		const tieBreakerUserId = await orgSvc.getTieBreaker(id);
		return json({ tie_breaker_user_id: tieBreakerUserId });
	});
