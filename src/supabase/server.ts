import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { RequestEvent } from '@sveltejs/kit';

export function createSupabaseServer(event: RequestEvent) {
	const isProd = process.env.NODE_ENV === 'production';
	return createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			get: (key: string) => event.cookies.get(key),
			set: (key: string, value: string, options: CookieOptions) => {
				event.cookies.set(key, value, { path: '/', secure: isProd, ...options });
			},
			remove: (key: string, options: CookieOptions) => {
				event.cookies.delete(key, { path: '/', secure: isProd, ...options });
			}
		}
	});
}

/**
 * Safe method to get session and user that avoids the Supabase warning.
 * This validates the session with the auth server.
 */
export async function safeGetSession(supabase: ReturnType<typeof createSupabaseServer>) {
	// Get the user from the auth server (validated)
	const {
		data: { user },
		error
	} = await supabase.auth.getUser();

	if (error || !user) {
		return { session: null, user: null };
	}

	// Only get the session after we've validated the user
	const {
		data: { session }
	} = await supabase.auth.getSession();

	return { session, user };
}
