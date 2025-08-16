import { withAuthRedirect } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import type { PageServerLoad } from './$types';

export const load = withAuthRedirect<PageServerLoad>(
	async ({ locals: { resolve, user, organizationContext } }) => {
		const orgService = resolve(organizationServiceKey);
		const orgs = await orgService.fetchMemberships(user.id);

		return { org: organizationContext, orgs };
	}
);
