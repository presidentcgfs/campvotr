import type { Handle } from '@sveltejs/kit';
import { createSupabaseServer, safeGetSession } from './supabase/server';
import { context } from '@pbinj/pbj';
import '@pbinj/pbj/scope';
import { register } from '$lib/services/pbj';
import { organizationServiceKey } from '$lib/services/org';
import { profileServiceKey } from '$lib/services/profile-service';
import './polyfill';

const ctx = register(context);
export const handle: Handle = async ({ event, resolve }) => {
	// Initialize Supabase SSR client attached to cookies
	const supabase = createSupabaseServer(event);
	event.locals.supabase = supabase;
	event.locals.resolve = (...args: any[]) => ctx.resolve(...(args as any[]));

	// Use the safe method to get validated session and user
	// This avoids the Supabase warning about using unverified session data
	const { session, user } = await safeGetSession(supabase);

	event.locals.session = session;
	event.locals.user = user;

	// Create or update user profile when user signs in
	if (user) {
		try {
			const profileService = ctx.resolve(profileServiceKey);
			await profileService.upsertProfile(user);
		} catch (e) {
			// Profile creation is non-fatal, log but continue
			console.error('Failed to upsert user profile:', e);
		}
	}

	// Resolve organization context for SSR
	try {
		(event as any).locals.organizationContext = await ctx
			.resolve(organizationServiceKey)
			.resolveOrganizationContext(event);
	} catch (e) {
		// org context is optional; ignore errors here

		// If a user just signed in, connect any pending org invites for their email
		try {
			if (user?.email) {
				const email = user.email.toLowerCase();
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
							user_id: user.id,
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
