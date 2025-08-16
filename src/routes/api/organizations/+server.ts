import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const svc = event.locals.resolve(organizationServiceKey);
		const organizations = await svc.fetchMemberships(user.id);
		return json({ organizations });
	});
