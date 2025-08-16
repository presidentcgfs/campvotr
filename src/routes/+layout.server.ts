import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({
	locals: { organizationContext, session, user }
}) => {
	return {
		organizationContext,
		session,
		user
	};
};
