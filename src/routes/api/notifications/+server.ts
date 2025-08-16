import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { notificationServiceKey } from '$lib/services/notification-service';

export const GET: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const notificationService = event.locals.resolve(notificationServiceKey);
			const notifications = await notificationService.getUserNotifications(user.id);
			return json({ notifications });
		});
	} catch (error) {
		return handleError(error);
	}
};
