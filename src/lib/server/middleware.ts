import type { RequestEvent } from '@sveltejs/kit';
import { getUser } from './auth';
import { json } from '@sveltejs/kit';
import { z } from 'zod';

export async function withAuth(
	event: RequestEvent,
	handler: (event: RequestEvent, user: any) => Promise<Response>
): Promise<Response> {
	try {
		// Prefer user from SSR cookies via hooks, fallback to Authorization header if present
		const user = (event as any).locals?.user ?? (await getUser(event));

		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// expose user on locals for downstream role checks
		(event as any).locals = { ...(event as any).locals, user };

		return await handler(event, user);
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json({ error: 'Validation error', details: z.flattenError(error) }, { status: 400 });
		}
		console.error('Auth middleware error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

export function handleError(error: any): Response {
	console.error('API Error:', error);

	if (error.message?.includes?.('Validation error')) {
		return json({ error: error.message }, { status: 400 });
	}

	if (error.message === 'Unauthorized') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	return json({ error: 'Internal server error' }, { status: 500 });
}
