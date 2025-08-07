import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/db';
import { organizations, organizationMemberships } from '$lib/db/schema';
import { withAuth } from '$lib/server/middleware';
import { requireOrgMembershipForSlug, requireOrgRoleForSlug } from '$lib/server/org';
import { rateLimit } from '$lib/server/rate-limit';

const themeSchema = z.object({
	primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
	secondaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
	accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
});

function normalizeDomain(input: string): string | null {
	try {
		let s = input.trim().toLowerCase();
		// Strip protocol if present
		s = s.replace(/^https?:\/\//, '');
		// Remove path and query and hash
		s = s.split('/')[0];
		// Remove port if present
		s = s.split(':')[0];
		// Remove trailing dot
		s = s.replace(/\.$/, '');
		if (!s) return null;
		// rudimentary domain validation: labels are a-z0-9- and dot separated, start/end alnum, length <=255
		if (s.length > 255) return null;
		const labels = s.split('.');
		if (labels.length < 2) return null;
		for (const label of labels) {
			if (!/^[a-z0-9-]+$/.test(label)) return null;
			if (!/[a-z0-9]/.test(label[0])) return null;
			if (!/[a-z0-9]/.test(label[label.length - 1])) return null;
			if (label.length === 0 || label.length > 63) return null;
		}
		return s;
	} catch {
		return null;
	}
}

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const slug = event.params.slug!;
		// Membership verified here with 404/403 as appropriate
		const ctx = await requireOrgMembershipForSlug(event, slug);
		return json({ organization: ctx.organization, role: ctx.role });
	});

export const PATCH: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const slug = event.params.slug!;
		await requireOrgRoleForSlug(event, slug, ['OWNER', 'ADMIN']);

		const body = await event.request.json();
		const name = typeof body.name === 'string' ? body.name : undefined;
		const theme = body.theme ? themeSchema.parse(body.theme) : undefined;
		const { data, error } = { data: null as any, error: null as any };

		const [org] = await db
			.select()
			.from(organizations)
			.where(eq(organizations.slug, slug))
			.limit(1);
		if (!org) return json({ error: 'Not found' }, { status: 404 });

		const updates: any = {};
		if (name) updates.name = name;
		if (theme) {
			updates.primary_color = theme.primaryColor;
			updates.secondary_color = theme.secondaryColor;
			updates.accent_color = theme.accentColor;
		}

		// Optional domain
		if (Object.prototype.hasOwnProperty.call(body, 'domain')) {
			const raw = body.domain;
			if (raw === null || raw === '') {
				updates.primary_domain = null;
			} else if (typeof raw === 'string') {
				const normalized = normalizeDomain(raw);
				if (!normalized)
					return json(
						{
							error:
								'Invalid or duplicate domain. Use a hostname like example.org (no http/https, paths, or ports).'
						},
						{ status: 422 }
					);
				// check duplicate
				const [conflict] = await db
					.select()
					.from(organizations)
					.where(eq(organizations.primary_domain, normalized))
					.limit(1);
				if (conflict && conflict.id !== org.id) {
					return json(
						{
							error:
								'Invalid or duplicate domain. Use a hostname like example.org (no http/https, paths, or ports).'
						},
						{ status: 409 }
					);
				}
				updates.primary_domain = normalized;
			}
		}

		const [updated] = await db
			.update(organizations)
			.set({ ...updates, updated_at: new Date() })
			.where(eq(organizations.id, org.id))
			.returning();

		return json({ organization: updated });
	});
