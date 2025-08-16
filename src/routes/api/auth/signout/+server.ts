import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthService } from '$lib/auth';
import { handleError } from '$lib/services/middleware';

export const POST: RequestHandler = async (event) => {
	try {
		await AuthService.signOut();
		const cookies = event.cookies.getAll();
		cookies.forEach((cookie) => {
			event.cookies.delete(cookie.name, { path: '/' });
		});
		return json({ message: 'Signed out successfully' });
	} catch (error) {
		return handleError(error);
	}
};
