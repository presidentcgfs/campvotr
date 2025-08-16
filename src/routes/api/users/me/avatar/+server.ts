import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/services/middleware';
import { userServiceKey } from '$lib/services/user-service';

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (_evt, user) => {
		// Get UserService instance through dependency injection
		const userService = event.locals.resolve(userServiceKey);

		// Parse form data
		const form = await event.request.formData();
		const file = form.get('file');

		// Validate file input
		if (!(file instanceof File)) {
			return json({ error: 'No file uploaded' }, { status: 422 });
		}

		// Upload avatar using the service
		const result = await userService.uploadAvatar({
			userId: user.id,
			file,
			supabaseClient: event.locals.supabase
		});

		return json({ avatar_url: result.avatarUrl });
	});

export const DELETE: RequestHandler = async (event) =>
	withAuth(event, async (_evt, user) => {
		// Get UserService instance through dependency injection
		const userService = event.locals.resolve(userServiceKey);

		// Get current avatar URL from user metadata
		const currentAvatarUrl = user.user_metadata?.avatar_url as string | undefined;

		// Delete avatar using the service
		await userService.deleteAvatar({
			userId: user.id,
			currentAvatarUrl,
			supabaseClient: event.locals.supabase
		});

		return json({ ok: true });
	});
