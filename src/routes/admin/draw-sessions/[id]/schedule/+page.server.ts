import type { Actions, PageServerLoad } from './$types';
import { withAuthRedirect } from '$lib/services/middleware';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { timeSlotServiceKey } from '$lib/services/timeslot-service';
import { pickServiceKey } from '$lib/services/pick-service';
import { generateTimeSlotsMulti } from '$lib/components/recurrence/recurrence-utils';
import { redirect } from '@sveltejs/kit';
import { dayNames } from '$lib/components/schedules/util';
import { fieldServiceKey } from '$lib/services/field-service';

export const load: PageServerLoad = withAuthRedirect(
	async ({ params, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) {
			redirect(302, '/login');
		}

		const sessionId = params.id;
		if (!sessionId) {
			redirect(302, '/admin/draw-sessions');
		}

		const drawSessionService = resolve(drawSessionServiceKey);
		const timeSlotService = resolve(timeSlotServiceKey);

		// Load session with schedules and fields
		const session = await drawSessionService.loadSession(sessionId);
		if (!session || session.organizationId !== orgId) {
			redirect(302, '/admin/draw-sessions');
		}

		// Load session state to get participants
		const sessionState = await drawSessionService.fetchSessionState(orgId, sessionId);
		const participants = sessionState?.participants || [];

		// Generate recurring time slot patterns from the session's schedules
		const timeSlots: {
			id: string;
			fieldId: string;
			fieldName: string;
			weekday: string;
			weekdayName: string;
			startTime: string;
			endTime: string;
			startUtc: string;
			endUtc: string;
			status: string;
			assignedParticipantId: string | null;
			organizationId: string;
			isPattern: boolean;
		}[] = [];

		// Generate time slot patterns from each schedule
		session.schedules?.forEach((schedule) => {
			if (schedule.recurrence && schedule.fields) {
				const recurrence = schedule.recurrence as any;

				// Get weekdays from the recurrence
				const weekdays = recurrence.weekdays || [];
				const timeWindows = recurrence.timeWindows || [];

				// Create time slot patterns for each combination of weekday + time window + field
				schedule.fields.forEach((field) => {
					weekdays.forEach((weekday: string) => {
						timeWindows.forEach((timeWindow: any, windowIndex: number) => {
							// Create a pattern-based time slot (not literal dates)
							timeSlots.push({
								id: `pattern-${field.fieldId}-${weekday}-${windowIndex}`,
								fieldId: field.fieldId,
								fieldName: field.field?.name,
								weekday: weekday,
								weekdayName: dayNames[weekday as keyof typeof dayNames] || weekday,
								startTime: timeWindow.start,
								endTime: timeWindow.end,
								// For display purposes, create sample UTC timestamps for this week
								startUtc: createSampleDateTime(weekday, timeWindow.start),
								endUtc: createSampleDateTime(weekday, timeWindow.end),
								status: 'available',
								assignedParticipantId: null,
								organizationId: orgId,
								isPattern: true // Flag to indicate this is a recurring pattern
							});
						});
					});
				});
			}
		});

		// Helper function to create sample datetime for display
		function createSampleDateTime(weekday: string, time: string): string {
			const dayMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
			const targetDay = dayMap[weekday as keyof typeof dayMap];

			const now = new Date();
			const currentDay = now.getUTCDay();
			const daysUntilTarget = (targetDay - currentDay + 7) % 7;

			const sampleDate = new Date(now);
			sampleDate.setUTCDate(now.getUTCDate() + daysUntilTarget);

			const [hours, minutes] = time.split(':').map(Number);
			sampleDate.setUTCHours(hours, minutes, 0, 0);

			return sampleDate.toISOString();
		}

		// Sort by weekday and time
		timeSlots.sort((a, b) => {
			const dayOrder = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
			const dayCompare = dayOrder.indexOf(a.weekday) - dayOrder.indexOf(b.weekday);
			if (dayCompare !== 0) return dayCompare;
			return a.startTime.localeCompare(b.startTime);
		});

		return {
			orgId,
			session,
			participants,
			timeSlots,
			defaultDateRange: {
				start: session.startDate.toISOString(),
				end: session.endDate.toISOString()
			}
		} as const;
	}
);

export const actions: Actions = {
	assign: withAuthRedirect(
		async ({ request, params, locals: { resolve, organizationContext } }) => {
			const orgId = organizationContext?.organization?.id;
			if (!orgId) return { error: 'No organization in context' };

			const sessionId = params.id;
			if (!sessionId) return { error: 'Missing session ID' };

			const form = await request.formData();
			const slotId = String(form.get('slotId') || '').trim();
			const participantId = String(form.get('participantId') || '').trim();

			if (!slotId || !participantId) {
				return { error: 'Missing slot ID or participant ID' };
			}

			// TODO: Check admin permissions
			// TODO: Validate slot is available and belongs to org/session
			// TODO: Assign slot to participant

			const timeSlotService = resolve(timeSlotServiceKey);
			const result = await timeSlotService.assignSlot(orgId, slotId, participantId);

			if (result.error) {
				return { error: result.error };
			}

			return { success: true, slot: result.slot };
		}
	),

	unassign: withAuthRedirect(
		async ({ request, params, locals: { resolve, organizationContext } }) => {
			const orgId = organizationContext?.organization?.id;
			if (!orgId) return { error: 'No organization in context' };

			const sessionId = params.id;
			if (!sessionId) return { error: 'Missing session ID' };

			const form = await request.formData();
			const slotId = String(form.get('slotId') || '').trim();

			if (!slotId) {
				return { error: 'Missing slot ID' };
			}

			// TODO: Check admin permissions
			// TODO: Validate slot belongs to org/session

			const timeSlotService = resolve(timeSlotServiceKey);
			const result = await timeSlotService.unassignSlot(orgId, slotId);

			if (result.error) {
				return { error: result.error };
			}

			return { success: true, slot: result.slot };
		}
	),

	pick: withAuthRedirect(
		async ({ request, params, locals: { resolve, organizationContext, user } }) => {
			const orgId = organizationContext?.organization?.id;
			if (!orgId) return { error: 'No organization in context' };

			const sessionId = params.id;
			if (!sessionId) return { error: 'Missing session ID' };

			const form = await request.formData();
			const slotId = String(form.get('slotId') || '').trim();

			if (!slotId) {
				return { error: 'Missing slot ID' };
			}

			// Use the existing performPick method which handles turn validation
			const pickService = resolve(pickServiceKey);
			try {
				const result = await pickService.performPick({
					organizationId: orgId,
					sessionId,
					userId: user.id,
					timeSlotId: slotId
				});
				return { success: true, result };
			} catch (e: any) {
				if (e?.status === 409) {
					return { error: 'Slot already picked' };
				}
				return { error: e?.message || 'Pick failed' };
			}
		}
	)
};
