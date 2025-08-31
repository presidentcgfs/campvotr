import type { RequestEvent } from '@sveltejs/kit';
import { getUser } from './auth';
import { json, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { z as z4 } from 'zod/v4';
import type { User } from '@supabase/supabase-js';
import type * as Kit from '@sveltejs/kit';

type UserDefFn<T extends Kit.ServerLoad<any, any, any, any>> = (
	event: Parameters<T>[0] & { locals: { user: User } }
) => ReturnType<T>;

export function withAuthRedirect<T extends Kit.ServerLoad<any, any, any, any>>(
	handler: UserDefFn<T>
) {
	return async (event: Parameters<T>[0]) => {
		try {
			// Prefer user from SSR cookies via hooks, fallback to Authorization header if present
			const user = event.locals?.user ?? (await getUser(event));

			if (!user) {
				throw redirect(
					303,
					`/auth?redirectTo=${encodeURIComponent(event.url.pathname + event.url.search)}`
				);
			}

			// expose user on locals for downstream role checks
			event.locals.user = user;

			return await handler(event as any);
		} catch (error) {
			if (error instanceof z4.ZodError) {
				return {
					status: 200,
					error: 'Validation error',
					details: z.flattenError(error)
				};
			} else if (error instanceof z.ZodError) {
				return {
					status: 200,
					error: 'Validation error',
					details: z.flattenError(error)
				};
			}
			console.error('Auth middleware error:', error);
			return json({ error: 'Internal server error' }, { status: 500 });
		}
	};
}

export async function withAuth(
	event: RequestEvent,
	handler: (event: RequestEvent, user: User) => Promise<Response>
): Promise<Response> {
	try {
		// Prefer user from SSR cookies via hooks, fallback to Authorization header if present
		const user = event.locals?.user ?? (await getUser(event));

		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// expose user on locals for downstream role checks
		event.locals.user = user;

		return await handler(event, user);
	} catch (error) {
		if (error instanceof z4.ZodError) {
			return json({ error: 'Validation error', details: z.flattenError(error) }, { status: 400 });
		} else if (error instanceof z.ZodError) {
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
