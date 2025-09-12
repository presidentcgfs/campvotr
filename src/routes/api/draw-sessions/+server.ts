import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { userServiceKey } from '$lib/services/user-service';
import { timeSlotServiceKey, type FieldSchedulesInput } from '$lib/services/timeslot-service';
import { parseResponse } from '$lib/utils/parse';
import { drawSessionSchema } from '$lib/db/zod';
import type { ParticipantCreate } from '$lib/db/types';
export const PUT: RequestHandler = (event) =>
	withAuth(event, async (evt) => {
		const orgId = evt.locals.organizationContext?.organization?.id;
		if (!orgId) return json({ error: 'No organization in context' }, { status: 400 });
		// Parse and validate request body using Zod schema
		const body = await parseResponse(drawSessionSchema, evt.request);
		const svc = evt.locals.resolve(drawSessionServiceKey);
		if (!body.id) return json({ error: 'Missing session ID' }, { status: 400 });
		const updated = await svc.updateSession(orgId, body.id, body);
		return json({ success: true, updated });
	});
export const POST: RequestHandler = async (event) =>
	withAuth(event, async (evt, user) => {
		const orgId = evt.locals.organizationContext?.organization?.id;
		if (!orgId) return json({ error: 'No organization in context' }, { status: 400 });
		// Parse and validate request body using Zod schema
		const body = await parseResponse(drawSessionSchema, evt.request);

		// Transform the new schema format to work with existing services
		// Convert schedules to fieldSchedules format expected by timeSlotService
		const fieldSchedulesMap: Record<string, any[]> = {};

		for (const schedule of body.schedules) {
			for (const fieldId of schedule.fieldIds) {
				if (!fieldSchedulesMap[fieldId]) {
					fieldSchedulesMap[fieldId] = [];
				}

				// Convert recurrence to the expected format
				const scheduleData = {
					startDate: body.startsAtUtc,
					endDate: body.endDate,
					days: schedule.recurrence.weekdays || [],
					windows: schedule.recurrence.timeWindows.map((tw) => ({
						startTime: tw.start,
						endTime: tw.end
					}))
				};

				fieldSchedulesMap[fieldId].push(scheduleData);
			}
		}

		const fieldSchedules = Object.entries(fieldSchedulesMap).map(([fieldId, schedules]) => ({
			fieldId,
			schedules
		}));

		// Participants validation: emails or email:role
		const entries = body.participants ?? [];
		const parsed = entries.filter(Boolean).map((e) => {
			const [emailRaw, roleRaw] = e.split(':');
			return {
				email: (emailRaw || '').trim().toLowerCase(),
				role: (roleRaw || '').trim() || undefined
			};
		});

		// Resolve members to userIds in this org
		const uSvc = evt.locals.resolve(userServiceKey);
		const resolved = await Promise.all(
			parsed.map(async (p) => {
				const m = await uSvc.findMemberByEmail(orgId, p.email);
				return { userId: m?.userId, ...p };
			})
		);

		// Create draw session first
		const dsvc = evt.locals.resolve(drawSessionServiceKey);
		const startsAtUtc = body.startDate; // Use startDate from schema
		const created = await dsvc.createSession({
			organizationId: orgId,
			name: body.name,
			turnStrategy: body.turnStrategy as any,
			rounds: null, // Default to unlimited rounds
			pickTimeoutSec: 60, // Default timeout
			startsAtUtc,
			createdByUserId: user.id,
			participants: resolved
		});

		// Generate slots from per-field schedules (server-side UTC handling)
		const tsvc = evt.locals.resolve(timeSlotServiceKey);
		const { total, perField, error } = await tsvc.createFromFieldSchedules(
			created.id,
			fieldSchedules,
			500
		);
		if (error) {
			// TODO: Consider rolling back the draw session creation
			return json({ error: `Session created but slots failed: ${error}` }, { status: 400 });
		}

		return json(
			{ success: true, session: created, generated: { total, perField } },
			{ status: 201 }
		);
	});
