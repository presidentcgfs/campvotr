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
	// Resolve organization context for SSR
	try {
		const { resolveOrganizationContext } = await import('$lib/server/org');
		(event as any).locals.organizationContext = await resolveOrganizationContext(event);
	} catch (e) {
		// org context is optional; ignore errors here

		// If a user just signed in, connect any pending org invites for their email
		try {
			if ((event as any).locals.user?.email) {
				const email = (event as any).locals.user.email.toLowerCase();
				const { db } = await import('$lib/db');
				const { organizationInvites, organizationMemberships } = await import('$lib/db/schema');
				const { eq } = await import('drizzle-orm');
				const invites = await db
					.select()
					.from(organizationInvites)
					.where(eq(organizationInvites.email, email));
				for (const inv of invites) {
					await db
						.insert(organizationMemberships)
						.values({
							organization_id: inv.organization_id,
							user_id: (event as any).locals.user.id,
							role: inv.role
						})
						.onConflictDoUpdate({
							target: [organizationMemberships.organization_id, organizationMemberships.user_id],
							set: { role: inv.role, updated_at: new Date() }
						});
					await db
						.update(organizationInvites)
						.set({ accepted_at: new Date(), updated_at: new Date() })
						.where(eq(organizationInvites.id, inv.id));
				}
			}
		} catch (e) {
			// non-fatal
		}
	}

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
