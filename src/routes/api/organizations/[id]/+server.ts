import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey, OrganizationService } from '$lib/services/org';
import { parseResponse } from '$lib/utils/parse';
import { idSchema } from '$lib/validation';

const updateSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	domain: z.string().optional().nullable(),
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
		const orgSvc = event.locals.resolve(organizationServiceKey);
		const id = idSchema.parse(event.params).id;
		await orgSvc.requireOrgRoleForId(event, id, ['OWNER', 'ADMIN']);
		const parsed = await parseResponse(updateSchema, event.request);

		if (parsed.domain) {
			const normalized = OrganizationService.normalizeDomain(parsed.domain);
			if (!normalized)
				return json(
					{
						error:
							'Invalid or duplicate domain. Use a hostname like example.org (no http/https, paths, or ports).'
					},
					{ status: 422 }
				);
			const conflict = await orgSvc.fetchOrganizationByDomain(normalized);
			if (conflict && conflict.id !== id) {
				return json(
					{
						error:
							'Invalid or duplicate domain. Use a hostname like example.org (no http/https, paths, or ports).'
					},
					{ status: 409 }
				);
			}
			parsed.domain = normalized;
		}

		const [updated] = await orgSvc.updateOrganization(id, parsed);
		return json({ organization: updated });
	});
