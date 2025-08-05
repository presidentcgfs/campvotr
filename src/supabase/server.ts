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
