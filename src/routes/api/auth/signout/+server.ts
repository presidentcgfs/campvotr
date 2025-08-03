import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthService } from '$lib/auth';
import { handleError } from '$lib/server/middleware';

export const POST: RequestHandler = async (event) => {
	try {
		await AuthService.signOut();
		return json({ message: 'Signed out successfully' });
	} catch (error) {
		return handleError(error);
	}
};
