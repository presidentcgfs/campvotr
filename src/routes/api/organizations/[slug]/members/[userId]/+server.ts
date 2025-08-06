import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { db } from '$lib/db';
import { organizationMemberships, organizations } from '$lib/db/schema';
import { and, eq, count } from 'drizzle-orm';
import { requireOrgRoleForSlug } from '$lib/server/org';

const roleSchema = z.object({ role: z.enum(['OWNER', 'ADMIN', 'EDITOR', 'MEMBER', 'VIEWER']) });

export const PATCH: RequestHandler = async (event) => {
	const slug = event.params.slug!;
	await requireOrgRoleForSlug(event, slug, ['OWNER', 'ADMIN']);
	const userId = event.params.userId!;
	const body = await event.request.json();
	const data = roleSchema.parse(body);

	const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
	if (!org) return json({ error: 'Not found' }, { status: 404 });

	// prevent demoting last OWNER
	if (data.role !== 'OWNER') {
		const [{ total }] = await db
			.select({ total: count() })
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organization_id, org.id),
					eq(organizationMemberships.role, 'OWNER')
				)
			);
		if (total === 1) {
			// Ensure the one being changed is an OWNER
			const [existing] = await db
				.select()
				.from(organizationMemberships)
				.where(
					and(
						eq(organizationMemberships.organization_id, org.id),
						eq(organizationMemberships.user_id, userId)
					)
				)
				.limit(1);
			if (existing?.role === 'OWNER')
				return json({ error: 'Cannot demote the last OWNER' }, { status: 422 });
		}
	}

	const [updated] = await db
		.update(organizationMemberships)
		.set({ role: data.role, updated_at: new Date() })
		.where(
			and(
				eq(organizationMemberships.organization_id, org.id),
				eq(organizationMemberships.user_id, userId)
			)
		)
		.returning();

	if (!updated) return json({ error: 'Member not found' }, { status: 404 });
	return json({ member: updated });
};

export const DELETE: RequestHandler = async (event) => {
	const slug = event.params.slug!;
	await requireOrgRoleForSlug(event, slug, ['OWNER', 'ADMIN']);
	const userId = event.params.userId!;

	const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
	if (!org) return json({ error: 'Not found' }, { status: 404 });

	// prevent removing last OWNER
	const [existing] = await db
		.select()
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.organization_id, org.id),
				eq(organizationMemberships.user_id, userId)
			)
		)
		.limit(1);
	if (!existing) return json({ error: 'Member not found' }, { status: 404 });

	if (existing.role === 'OWNER') {
		const [{ total }] = await db
			.select({ total: count() })
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organization_id, org.id),
					eq(organizationMemberships.role, 'OWNER')
				)
			);
		if (total === 1) return json({ error: 'Cannot remove the last OWNER' }, { status: 422 });
	}

	await db
		.delete(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.organization_id, org.id),
				eq(organizationMemberships.user_id, userId)
			)
		);

	return json({ ok: true });
};
