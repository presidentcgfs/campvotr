import type { Handle } from '@sveltejs/kit';
import { createSupabaseServer } from './supabase/server';
import { dev } from '$app/environment';

export const handle: Handle = async ({ event, resolve }) => {
	// Initialize Supabase SSR client attached to cookies
	const supabase = createSupabaseServer(event);
	event.locals.supabase = supabase;

	// Retrieve session and user for downstream use
	const {
		data: { session }
	} = await supabase.auth.getSession();
	event.locals.session = session ?? null;
	event.locals.user = session?.user ?? null;

	// Add CORS headers for API routes
	if (event.url.pathname.startsWith('/api')) {
		if (event.request.method === 'OPTIONS') {
			return new Response(null, {
				status: 200,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					'Access-Control-Max-Age': '86400'
				}
			});
		}
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});

	// Add CORS headers to API responses
	if (event.url.pathname.startsWith('/api')) {
		response.headers.set('Access-Control-Allow-Origin', '*');
		response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
		response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	}

	return response;
};
