import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NotificationService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';
import { idSchema } from '$lib/validation';

export const POST: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const { id } = idSchema.parse(event.params);
			const notification = await NotificationService.markAsRead(id);

			if (!notification) {
				return json({ error: 'Notification not found' }, { status: 404 });
			}

			return json({ notification });
		});
	} catch (error) {
		return handleError(error);
	}
};
