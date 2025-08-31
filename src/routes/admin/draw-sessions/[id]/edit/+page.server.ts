import type { Actions, PageServerLoad } from './$types';
import { withAuthRedirect } from '$lib/services/middleware';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { drawSessionAdminServiceKey } from '$lib/services/draw-session-admin-service';
import { fieldServiceKey } from '$lib/services/field-service';
import { redirect } from '@sveltejs/kit';

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

		// Get session details
		const [draw, fields] = await Promise.all([svc.loadSession(sessionId), fsvc.listFields(orgId)]);
		if (!(draw && fields)) {
			throw Error('could not find objects');
		}
		draw.schedules.forEach((v) => {
			v.fieldIds = v.fields.map((f) => f.fieldId);
		});
		return { draw, fields } as const;
	}
);

export const actions: Actions = {
	default: withAuthRedirect(
		async ({ request, params, locals: { resolve, organizationContext } }) => {
			const orgId = organizationContext?.organization?.id;
			if (!orgId) return { error: 'No organization in context' };

			const sessionId = params.id;
			if (!sessionId) return { error: 'Missing session ID' };

			const form = await request.formData();
			const name = String(form.get('name') || '').trim();
			const turnStrategy = String(form.get('turnStrategy') || 'fixed') as any;
			const roundsStr = String(form.get('rounds') || '').trim();
			const rounds = roundsStr ? Number(roundsStr) : null;
			const pickTimeoutSec = Number(form.get('pickTimeoutSec') || '60');
			const startsAt = String(form.get('startsAtUtc') || '').trim();

			if (!name) return { error: 'Name is required' };

			if (roundsStr && (isNaN(rounds!) || rounds! < 1)) {
				return { error: 'Rounds must be a positive number' };
			}

			if (pickTimeoutSec < 10 || pickTimeoutSec > 3600) {
				return { error: 'Timeout must be between 10 and 3600 seconds' };
			}

			const validStrategies = ['fixed', 'randomized', 'snake'];
			if (!validStrategies.includes(turnStrategy)) {
				return { error: 'Invalid turn strategy' };
			}

			const startsAtUtc = startsAt ? new Date(startsAt) : undefined;
			if (startsAt && isNaN(startsAtUtc!.getTime())) {
				return { error: 'Invalid start date' };
			}

			// Handle schedule updates (simplified for now - just log the data)
			const schedulesRaw = String(form.get('schedules') || '[]').trim();

			// TODO: Implement RecurrenceMulti schedule updates using draw-session-admin-service
			// For now, we'll just update the basic session properties
			console.log('Schedules data received:', schedulesRaw);

			// Update the session with basic properties
			const dsvc = resolve(drawSessionServiceKey);
			const updated = await dsvc.updateSession(orgId, sessionId, {
				name,
				turnStrategy,
				rounds,
				pickTimeoutSec,
				startsAtUtc
			});

			if (!updated) {
				return { error: 'Failed to update session' };
			}

			redirect(302, '/admin/draw-sessions');
		}
	)
};
