import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthService } from '$lib/auth';
import { handleError } from '$lib/server/middleware';
import { authSchema } from '$lib/validation';

export const POST: RequestHandler = async (event) => {
	try {
		const body = await event.request.json();
		const validatedData = authSchema.parse(body);
		const result = await AuthService.signIn(validatedData.email, validatedData.password);

		return json({
			message: 'Signed in successfully',
			user: result.user,
			session: result.session
		});
	} catch (error) {
		return handleError(error);
	}
};
