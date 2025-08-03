import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NotificationService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';

export const POST: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const { id } = event.params;
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
