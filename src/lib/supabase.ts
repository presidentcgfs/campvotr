import { createBrowserClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

if (!PUBLIC_SUPABASE_URL) {
	throw new Error('PUBLIC_SUPABASE_URL is not set');
}

if (!PUBLIC_SUPABASE_ANON_KEY) {
	throw new Error('PUBLIC_SUPABASE_ANON_KEY is not set');
}

export const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);
