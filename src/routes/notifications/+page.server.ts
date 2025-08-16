import { withAuthRedirect } from '$lib/services/middleware';
import { notificationServiceKey } from '$lib/services/notification-service';
import type { PageServerLoad } from './$types';

export const load = withAuthRedirect<PageServerLoad>(async ({ locals }) => {
	const notifications = await locals
		.resolve(notificationServiceKey)
		.getUserNotifications(locals.user.id);
	return {
		notifications
	};
});
