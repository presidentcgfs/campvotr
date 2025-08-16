import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey, OrganizationService } from '$lib/services/org';

const themeSchema = z.object({
	primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
	secondaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
	accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
});

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = event.params.id!;
		const orgSvc = event.locals.resolve(organizationServiceKey);
		const ctx = await orgSvc.requireOrgMembershipForId(event, id);
		return json({ organization: ctx.organization, role: ctx.role });
	});

export const PATCH: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = event.params.id!;
		const orgSvc = event.locals.resolve(organizationServiceKey);
		await orgSvc.requireOrgRoleForId(event, id, ['OWNER', 'ADMIN']);

		const body = await event.request.json();
		const name = typeof body.name === 'string' ? body.name : undefined;
		const theme = body.theme ? themeSchema.parse(body.theme) : undefined;

		const org = await orgSvc.fetchOrganization(id);
		if (!org) return json({ error: 'Not found' }, { status: 404 });

		const updates: any = {};
		if (name) updates.name = name;
		if (theme) {
			updates.primary_color = theme.primaryColor;
			updates.secondary_color = theme.secondaryColor;
			updates.accent_color = theme.accentColor;
		}

		if (Object.prototype.hasOwnProperty.call(body, 'domain')) {
			const raw = body.domain;
			if (raw === null || raw === '') {
				updates.primary_domain = null;
			} else if (typeof raw === 'string') {
				const normalized = OrganizationService.normalizeDomain(raw);
				if (!normalized)
					return json(
						{
							error:
								'Invalid or duplicate domain. Use a hostname like example.org (no http/https, paths, or ports).'
						},
						{ status: 422 }
					);
				const conflict = await orgSvc.fetchOrganizationByDomain(normalized);
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

		const [updated] = await orgSvc.updateOrganization(org.id, updates);
		return json({ organization: updated });
	});
