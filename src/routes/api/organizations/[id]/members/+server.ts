import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { organizationServiceKey } from '$lib/services/org';
import { rateLimit } from '$lib/services/rate-limit';
import { supabaseAdmin } from '$lib/services/auth';
import { emailServiceKey } from '$lib/services/email';
import { idSchema, orgRolesEnum } from '$lib/validation';
import { withAuth } from '$lib/services/middleware';

const addMemberSchema = z.union([
	z.object({
		userId: z.uuid(),
		role: orgRolesEnum.default('MEMBER')
	}),
	z.object({
		email: z.email(),
		role: orgRolesEnum
	})
]);

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = idSchema.parse(event.params).id;
		const orgSvc = event.locals.resolve(organizationServiceKey);

		// Allow any member to view the list (read-only for non-admins)
		const ctx = await orgSvc.requireOrgMembershipForId(event, id);

		const members = await orgSvc.fetchMembers(id);
		return json({ members });
	});

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = event.params.id!;
		const orgSvc = event.locals.resolve(organizationServiceKey);
		const emailService = event.locals.resolve(emailServiceKey);

		await orgSvc.requireOrgRoleForId(event, id, ['OWNER', 'ADMIN']);

		const rl = rateLimit(event.getClientAddress?.() ?? '', `/api/org/${id}/members`, 20, 60_000);
		if (!rl.allowed) return json({ error: 'Too Many Requests' }, { status: 429 });

		const body = await event.request.json();
		const data = addMemberSchema.parse(body);

		const org = await orgSvc.fetchOrganization(id);
		if (!org) return json({ error: 'Not found' }, { status: 404 });

		// Resolve userId if email provided
		let userId: string | null = 'userId' in data ? data.userId : null;
		if (!userId && 'email' in data) {
			// Try to find Supabase user by email
			let page = 1;
			let foundId: string | null = null;
			while (page <= 10 && !foundId) {
				const { data: pageData, error: pageError } = await supabaseAdmin.auth.admin.listUsers({
					page,
					perPage: 100
				});
				if (pageError) return json({ error: 'Unable to lookup user by email' }, { status: 500 });
				const match = pageData.users.find(
					(u) => (u.email ?? '').toLowerCase() === data.email.toLowerCase()
				);
				if (match) foundId = match.id;
				if (pageData.users.length < 100) break;
				page += 1;
			}
			userId = foundId;
		}

		if (!userId) {
			// Create or update a pending invite and send email
			const invite = await orgSvc.createOrUpdateInvite(
				org.id,
				(data as any).email,
				(data as any).role
			);

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

		const member = await orgSvc.createOrUpdateMember(org.id, userId, (data as any).role);
		return json({ member }, { status: 201 });
	});
