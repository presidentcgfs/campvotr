import type { Actions, PageServerLoad } from './$types';
import { withAuthRedirect } from '$lib/services/middleware';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { drawSessionAdminServiceKey } from '$lib/services/draw-session-admin-service';
import { fieldServiceKey } from '$lib/services/field-service';
import { fail, redirect } from '@sveltejs/kit';
import { extractResponse, parseResponse } from '$lib/utils/parse';
import { validateDrawSession } from '$lib/services/validate';
import { error } from '@sveltejs/kit';
import { drawSessionSchema } from '$lib/schemas/draw-session-schemas';

export const load = withAuthRedirect<PageServerLoad>(
	async ({ params, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { orgId: null, session: null, fields: [] } as any;

		const sessionId = params.id;
		if (!sessionId) {
			throw redirect(302, '/admin/draw-sessions');
		}

		const svc = resolve(drawSessionServiceKey);
		const fsvc = resolve(fieldServiceKey);
		const adminSvc = resolve(drawSessionAdminServiceKey);

		// Get session details and participants
		const [draw, fields, participants] = await Promise.all([
			svc.loadSession(sessionId),
			fsvc.listFields(orgId),
			adminSvc.getSessionParticipants(sessionId)
		]);
		if (!(draw && fields)) {
			throw Error('could not find objects');
		}
		draw.schedules.forEach((v) => {
			v.fieldIds = v.fields.map((f) => f.fieldId);
		});
		return { draw, fields, participants } as const;
	}
);

export const actions: Actions = {
	update: withAuthRedirect(
		async ({ request, params, locals: { resolve, organizationContext } }) => {
			const orgId = organizationContext?.organization?.id;
			if (!orgId) return { error: 'No organization in context' };

			const sessionId = params.id;
			if (!sessionId) return { error: 'Missing session ID' };
			const value = await parseResponse(drawSessionSchema, request);
			// Update the session with basic properties
			const dsvc = resolve(drawSessionServiceKey);
			const updated = await dsvc.updateSession(orgId, sessionId, value);

			if (!updated) {
				return fail(400, { error: 'Failed to update session' });
			}
			return { success: true, message: 'Draw updated successfully' };
		}
	),

	addParticipant: withAuthRedirect(
		async ({ request, params, locals: { resolve, organizationContext } }) => {
			const orgId = organizationContext?.organization?.id;
			if (!orgId) return { error: 'No organization in context' };

			const sessionId = params.id;
			if (!sessionId) return { error: 'Missing session ID' };

			const form = await request.formData();
			const email = String(form.get('email') || '')
				.trim()
				.toLowerCase();
			const role = String(form.get('role') || 'member').trim();

			if (!email) return { error: 'Email is required' };

			const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRe.test(email)) {
				return { error: 'Invalid email format' };
			}

			try {
				const adminSvc = resolve(drawSessionAdminServiceKey);
				await adminSvc.addParticipant(sessionId, orgId, email, role);
				return { success: 'Participant added successfully' };
			} catch (error: any) {
				return { error: error.message || 'Failed to add participant' };
			}
		}
	),

	removeParticipant: withAuthRedirect(
		async ({ request, params, locals: { resolve, organizationContext } }) => {
			const orgId = organizationContext?.organization?.id;
			if (!orgId) return { error: 'No organization in context' };

			const sessionId = params.id;
			if (!sessionId) return { error: 'Missing session ID' };

			const form = await request.formData();
			const participantId = String(form.get('participantId') || '').trim();
			const participantType = String(form.get('participantType') || '').trim() as
				| 'member'
				| 'email';

			if (!participantId) return { error: 'Participant ID is required' };
			if (!['member', 'email'].includes(participantType)) {
				return { error: 'Invalid participant type' };
			}

			try {
				const adminSvc = resolve(drawSessionAdminServiceKey);
				await adminSvc.removeParticipant(sessionId, orgId, participantId, participantType);
				return { success: 'Participant removed successfully' };
			} catch (error: any) {
				return { error: error.message || 'Failed to remove participant' };
			}
		}
	)
};
