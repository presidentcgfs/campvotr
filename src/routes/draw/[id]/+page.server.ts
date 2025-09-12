import type { Actions, PageServerLoad } from './$types';
import { withAuthRedirect } from '$lib/services/middleware';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { timeSlotServiceKey } from '$lib/services/timeslot-service';
import { pickServiceKey } from '$lib/services/pick-service';
import { fieldServiceKey } from '$lib/services/field-service';

export const load = withAuthRedirect<PageServerLoad>(
	async ({ params, locals: { resolve, organizationContext, user } }) => {
		const orgId = organizationContext?.organization?.id;
		const sessionId = params.id;
		if (!orgId)
			return {
				orgId: null,
				session: null,
				participants: [],
				picks: [],
				available: [],
				current: null
			} as any;

		const drawSvc = resolve(drawSessionServiceKey);
		const slotSvc = resolve(timeSlotServiceKey);
		const fieldSvc = resolve(fieldServiceKey);

		const state = await drawSvc.fetchSessionState(orgId, sessionId);
		let current: {
			roundNumber: number;
			turnNumber: number;
			participantId: string | undefined;
		} | null = null;
		if (state) current = await drawSvc.computeFixedTurn(orgId, sessionId);

		// Fetch available slots in the next 30 days as a simple default window
		const now = new Date();
		const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
		const available = await slotSvc.fetchAvailable(
			{ drawSessionId: sessionId, startUtc: now, endUtc: end, status: ['available'] as any },
			{ includeFieldName: true }
		);

		const isMyTurn = !!(
			current &&
			state?.participants.find((p) => p.id === current!.participantId && p.userId === user.id)
		);

		return {
			orgId,
			session: state?.session ?? null,
			participants: state?.participants ?? [],
			picks: state?.picks ?? [],
			available,
			fields: await fieldSvc.listFields(orgId),
			current,
			isMyTurn
		} as const;
	}
);

export const actions: Actions = {
	pick: withAuthRedirect(
		async ({ params, request, locals: { resolve, organizationContext, user } }) => {
			const orgId = organizationContext?.organization?.id;
			if (!orgId) return { error: 'No organization in context' };
			const sessionId = params.id;
			const form = await request.formData();
			const timeSlotId = String(form.get('timeSlotId') || '').trim();
			if (!timeSlotId) return { error: 'Missing timeSlotId' };

			const svc = resolve(pickServiceKey);
			try {
				const result = await svc.performPick({
					organizationId: orgId,
					sessionId,
					userId: user.id,
					timeSlotId
				});
				return { success: true, result };
			} catch (e: any) {
				if (e?.status === 409) {
					return { error: 'Slot already picked' };
				}
				return { error: e?.message || 'Pick failed' };
			}
		}
	) as any
};
