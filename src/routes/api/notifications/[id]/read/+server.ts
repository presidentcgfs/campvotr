import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { idSchema } from '$lib/validation';
import { notificationServiceKey } from '$lib/services/notification-service';

export const POST: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const { id } = idSchema.parse(event.params);
			const notificationService = event.locals.resolve(notificationServiceKey);
			const notification = await notificationService.markAsRead(id);

			if (!notification) {
				return json({ error: 'Notification not found' }, { status: 404 });
			}

			return json({ notification });
		});
	} catch (error) {
		return handleError(error);
	}
};
