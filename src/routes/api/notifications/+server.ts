import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NotificationService } from '$lib/db/queries';
import { withAuth, handleError } from '$lib/server/middleware';

export const GET: RequestHandler = async (event) => {
	try {
		return await withAuth(event, async (event, user) => {
			const notifications = await NotificationService.getUserNotifications(user.id);
			return json({ notifications });
		});
	} catch (error) {
		return handleError(error);
	}
};
