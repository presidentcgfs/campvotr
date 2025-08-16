import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import type { RequestEvent } from '@sveltejs/kit';

if (!PUBLIC_SUPABASE_URL) {
	throw new Error('PUBLIC_SUPABASE_URL is not set');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
	throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
}

// Server-side Supabase client with service role key
export const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Client for user authentication
export const supabaseServer = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY || '');

export async function getUser(event: RequestEvent) {
	const authHeader = event.request.headers.get('authorization');

	if (!authHeader) {
		return null;
	}

	const token = authHeader.replace('Bearer ', '');

	try {
		const {
			data: { user },
			error
		} = await supabaseServer.auth.getUser(token);

		if (error || !user) {
			return null;
		}

		return user;
	} catch {
		return null;
	}
}

export async function requireAuth(event: RequestEvent) {
	const user = await getUser(event);

	if (!user) {
		throw new Response('Unauthorized', { status: 401 });
	}

	return user;
}
