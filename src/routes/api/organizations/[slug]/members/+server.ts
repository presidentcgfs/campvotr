import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { db } from '$lib/db';
import { organizationMemberships, organizations, organizationInvites } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { requireOrgRoleForSlug } from '$lib/server/org';
import { rateLimit } from '$lib/server/rate-limit';
import { supabaseAdmin } from '$lib/server/auth';
import { emailService } from '$lib/server/email.svelte';
import { authUsers } from 'drizzle-orm/supabase';

const addMemberSchema = z.union([
	z.object({
		userId: z.string().uuid(),
		role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'MEMBER', 'VIEWER']).default('MEMBER')
	}),
	z.object({
		email: z.string().email(),
		role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'MEMBER', 'VIEWER']).default('MEMBER')
	})
]);
const roleSchema = z.object({ role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'MEMBER', 'VIEWER']) });

export const GET: RequestHandler = async (event) => {
	const slug = event.params.slug!;
	// Allow any member to view the list (read-only for non-admins)
	const { requireOrgMembershipForSlug } = await import('$lib/server/org');
	await requireOrgMembershipForSlug(event, slug);
	const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
	if (!org) return json({ error: 'Not found' }, { status: 404 });
	const result = await db
		.select()
		.from(organizationMemberships)
		.leftJoin(authUsers, eq(organizationMemberships.user_id, authUsers.id))
		.where(eq(organizationMemberships.organization_id, org.id));
	const members = result.map((m) => ({
		...m.organization_memberships,
		user: m.users
	}));
	return json({ members });
};

export const POST: RequestHandler = async (event) => {
	const slug = event.params.slug!;
	await requireOrgRoleForSlug(event, slug, ['OWNER', 'ADMIN']);
	const rl = rateLimit(event.getClientAddress?.() ?? '', `/api/org/${slug}/members`, 20, 60_000);
	if (!rl.allowed) return json({ error: 'Too Many Requests' }, { status: 429 });
	const body = await event.request.json();
	const data = addMemberSchema.parse(body);
	const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
	if (!org) return json({ error: 'Not found' }, { status: 404 });

	// Resolve userId if email provided
	let userId: string | null = 'userId' in data ? data.userId : null;
	if (!userId && 'email' in data) {
		// Try to find Supabase user by email
		// Supabase Admin API v2 lacks direct filter param; list pages and search in-app
		let page = 1;
		let foundId: string | null = null;
		while (page <= 10 && !foundId) {
			// hard cap 10 pages to bound work
			const { data: pageData, error: pageError } = await supabaseAdmin.auth.admin.listUsers({
				page,
				perPage: 100
			});
			if (pageError) return json({ error: 'Unable to lookup user by email' }, { status: 500 });
			const match = pageData.users.find(
				(u) => (u.email ?? '').toLowerCase() === data.email.toLowerCase()
			);
			if (match) foundId = match.id;
			if (pageData.users.length < 100) break; // last page
			page += 1;
		}
		userId = foundId;
	}

	if (!userId) {
		// Create or update a pending invite and send email
		const [invite] = await db
			.insert(organizationInvites)
			.values({ organization_id: org.id, email: (data as any).email, role: (data as any).role })
			.onConflictDoUpdate({
				target: [organizationInvites.organization_id, organizationInvites.email],
				set: { role: (data as any).role, updated_at: new Date(), accepted_at: null }
			})
			.returning();
		// fire-and-forget email; do not block response
		emailService
			.sendOrganizationInviteEmail({
				recipientEmail: (data as any).email,
				organizationName: org.name,
				role: (data as any).role
			})
			.catch(() => {});
		return json({ invite, pending: true }, { status: 201 });
	}

	const [member] = await db
		.insert(organizationMemberships)
		.values({ organization_id: org.id, user_id: userId, role: (data as any).role })
		.onConflictDoUpdate({
			target: [organizationMemberships.organization_id, organizationMemberships.user_id],
			set: { role: (data as any).role, updated_at: new Date() }
		})
		.returning();

	return json({ member }, { status: 201 });
};
