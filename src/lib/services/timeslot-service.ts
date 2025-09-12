import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import { timeSlots, fields } from '$lib/db/schema';
import { and, count, desc, eq, gt, lt, inArray } from 'drizzle-orm';
import {
	toDate,
	toRuleStr,
	type RecurrenceMulti,
	type TimeWindow
} from '$lib/components/recurrence/recurrence-utils';
import { RRuleTemporal } from 'rrule-temporal';
import { Temporal } from '@js-temporal/polyfill';
import type { TimeSlotCreate } from '$lib/db/types';
import type { DrawParticipant, DrawSession, TimeSlot } from '$lib/schemas/draw-session-schemas';
import {
	timeSlotAssignmentSchema,
	type TimeSlotAssignment
} from '$lib/schemas/draw-session-schemas';
import { dayNames, dayNamesShort } from '$lib/components/schedules/util';
import { drawSessionServiceKey } from './draw-session-service';
import type { TimeSlotInsert } from '$lib/db/zod';

export interface TimeSlotFilter {
	drawSessionId: string;
	fieldId?: string;
	startUtc?: Date; // inclusive
	endUtc?: Date; // exclusive
	status?: ('available' | 'held' | 'picked' | 'blocked')[];
}

// Field-based scheduling types
export interface FieldTimeWindow {
	startTime: string;
	endTime: string;
}
export interface PerFieldSchedule {
	startDate: string; // YYYY-MM-DD (UTC)
	endDate: string; // YYYY-MM-DD (UTC)
	days: string[]; // e.g., ['MO','TU']
	windows: FieldTimeWindow[]; // HH:mm
}
export interface FieldSchedulesInput {
	fieldId: string;
	schedules: PerFieldSchedule[];
}

export const timeSlotServiceKey = pbjKey<TimeSlotService>('timeSlotService');
export class TimeSlotService extends BaseService {
	constructor(
		db = pbj(drizzleKey),
		private drawSvc = pbj(drawSessionServiceKey)
	) {
		super(db);
	}
	async loadAllSlots(drawSessionId: string) {
		// Load session with schedules and fields
		const session = await this.drawSvc.loadSession(drawSessionId);
		if (!session) return [];

		// Load session state to get participants
		const participants = session?.participants || [];

		// Generate synthetic slots from session schedules
		const syntheticSlots = new Map<string, any>();

		// Process each schedule to generate synthetic slots
		if (session.schedules?.length) {
			for (const schedule of session.schedules) {
				// Get the recurrence configuration
				const recurrence = schedule.recurrence as RecurrenceMulti;

				// Generate actual time slots for this recurrence pattern
				for (const weekday of recurrence.weekdays ?? []) {
					// Create synthetic slots for each field in this schedule
					if (schedule.fields && schedule.fields.length > 0) {
						for (const fieldInfo of schedule.fields) {
							// fieldInfo has { id, fieldId, field: { id, name, ... } }
							const fieldId = fieldInfo.fieldId;
							const fieldData = (fieldInfo as any).field;
							const fieldName = fieldData?.name || 'Unknown Field';

							// Create a synthetic slot for each generated time slot
							for (const timeSlot of recurrence.timeWindows) {
								const startDate = toDate(recurrence.startDate)!;
								const endDate =
									toDate(
										recurrence?.endCondition?.type === 'onDate'
											? recurrence?.endCondition?.onDate
											: session.endDate!
									) ?? startDate;

								// Extract weekday information
								const weekdayName = dayNames[weekday as keyof typeof dayNames] || weekday;

								// Extract time information
								const startTime = timeSlot.start;
								const endTime = timeSlot.end;

								// Generate a simple pattern for this time slot
								const startInstant = Temporal.Instant.from(startDate.toISOString());
								const dtstart = startInstant.toZonedDateTimeISO('UTC');

								const rule = new RRuleTemporal({
									dtstart: dtstart,
									freq:
										recurrence.frequency === 'once'
											? 'DAILY'
											: (recurrence.frequency.toUpperCase() as any),
									byDay: [weekday],
									byHour: [Number(startTime.split(':')[0])],
									byMinute: [Number(startTime.split(':')[1])],
									count: 1
								});

								const pattern = rule.toString();
								const key = `${fieldId}:${weekday}:${startTime}-${endTime}`; // Use simple key for dedup

								// Only add if not already present
								if (!syntheticSlots.has(key)) {
									syntheticSlots.set(key, {
										id: `new:${key}`, // Synthetic ID
										organizationId: session.organizationId,
										fieldId,
										fieldName,
										pattern,
										startUtc: startDate.toISOString(),
										endUtc: endDate?.toISOString(),
										startTime,
										endTime,
										weekday: dayNamesShort.indexOf(weekdayName),
										weekdayName,
										status: 'available',
										heldByUserId: null,
										isSynthetic: true, // Mark as synthetic
										isPattern: true,
										slot: key
									});
								}
							}
						}
					}
				}
			}
		}

		// Merge synthetic and DB slots (DB slots take precedence)
		const mergedSlots = new Map<string, any>(syntheticSlots);

		// Override synthetic slots with DB slots where they exist
		for (const dbSlot of session.timeSlots || []) {
			// DB slot takes precedence
			mergedSlots.set(dbSlot.slot, {
				...dbSlot,
				fieldName: dbSlot.field?.name || 'Unknown Field',
				weekdayName: dayNamesShort[dbSlot.weekday],
				isSynthetic: false, // This is a real DB slot
				isPattern: true
			});
		}

		// Convert to array and sort
		const timeSlots = Array.from(mergedSlots.values());

		// Sort by weekday, time, and field
		timeSlots.sort((a, b) => {
			const dayOrder = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
			const dayCompare = dayOrder.indexOf(a.weekday) - dayOrder.indexOf(b.weekday);
			if (dayCompare !== 0) return dayCompare;
			const timeCompare = a.startTime.localeCompare(b.startTime);
			if (timeCompare !== 0) return timeCompare;
			return a.fieldName.localeCompare(b.fieldName);
		});

		// Get fields from schedules
		const fieldsMap = new Map();
		if (session.schedules) {
			session.schedules.forEach((schedule) => {
				if (schedule.fields) {
					schedule.fields.forEach((fieldInfo) => {
						// fieldInfo has the field relation loaded
						const field = (fieldInfo as any).field;
						if (field) {
							fieldsMap.set(fieldInfo.fieldId, field);
						}
					});
				}
			});
		}

		// Map participants to DrawParticipant type
		const mappedParticipants = participants.map((p) => ({
			id: p.id,
			email: p.email || '',
			displayName: p.email || 'Unknown',
			avatarUrl: null
		}));

		// Map session to DrawSession type
		const mappedSession = {
			id: session.id,
			organizationId: session.organizationId,
			name: session.name,
			startDate: session.startDate,
			endDate: session.endDate,
			rounds: session.rounds,
			schedules:
				session.schedules?.map((s) => ({
					...s,
					sessionId: s.drawSessionId,
					recurrence: s.recurrence as RecurrenceMulti,
					fields:
						s.fields?.map((f: any) => ({
							...f,
							field: fieldsMap.get(f.fieldId) || {
								id: f.fieldId,
								name: 'Unknown Field',
								description: null,
								location: null,
								capacity: null
							}
						})) || []
				})) || []
		};

		const result = {
			orgId: session.organizationId,
			session: mappedSession,
			participants: mappedParticipants,
			timeSlots: timeSlots as TimeSlot[],
			defaultDateRange: {
				start: session.startDate.toISOString(),
				end: session.endDate.toISOString()
			}
		} as const;
		return result;
	}

	async fetchAvailable(params: TimeSlotFilter, options?: { includeFieldName?: boolean }) {
		const whereParts: any[] = [eq(timeSlots.drawSessionId, params.drawSessionId)];
		if (params.fieldId) whereParts.push(eq(timeSlots.fieldId, params.fieldId));
		if (params.startUtc) whereParts.push(gt(timeSlots.endUtc, params.startUtc));
		if (params.endUtc) whereParts.push(lt(timeSlots.startUtc, params.endUtc));
		if (params.status?.length)
			whereParts.push(inArray(timeSlots.status as any, params.status as any));

		if (options?.includeFieldName) {
			const rows = await this.db
				.select()
				.from(timeSlots)
				.leftJoin(fields, eq(timeSlots.fieldId, fields.id))
				.where(and(...whereParts))
				.orderBy(desc(timeSlots.startUtc));
			return rows.map((r: any) => ({ ...r.time_slots, fieldName: r.fields?.name ?? null }));
		}

		const rows = await this.db
			.select()
			.from(timeSlots)
			.where(and(...whereParts))
			.orderBy(desc(timeSlots.startUtc));
		return rows;
	}

	async blockSlot(drawSessionId: string, timeSlotId: string, reason: string) {
		const [row] = await this.db
			.update(timeSlots)
			.set({ status: 'blocked', blockedReason: reason, updatedAt: new Date() })
			.where(and(eq(timeSlots.drawSessionId, drawSessionId), eq(timeSlots.id, timeSlotId)))
			.returning();
		return row ?? null;
	}

	async unblockSlot(drawSessionId: string, timeSlotId: string) {
		const [row] = await this.db
			.update(timeSlots)
			.set({ status: 'available', blockedReason: null, updatedAt: new Date() })
			.where(and(eq(timeSlots.drawSessionId, drawSessionId), eq(timeSlots.id, timeSlotId)))
			.returning();
		return row ?? null;
	}

	// List time slots with optional filtering and field name inclusion
	async listTimeSlots(
		drawSessionId: string,
		options?: {
			startDate?: string;
			endDate?: string;
			fieldId?: string;
			includeFieldName?: boolean;
		}
	) {
		const whereParts: any[] = [eq(timeSlots.drawSessionId, drawSessionId)];

		if (options?.startDate) {
			whereParts.push(gt(timeSlots.startUtc, new Date(options.startDate)));
		}
		if (options?.endDate) {
			whereParts.push(lt(timeSlots.startUtc, new Date(options.endDate)));
		}
		if (options?.fieldId) {
			whereParts.push(eq(timeSlots.fieldId, options.fieldId));
		}

		if (options?.includeFieldName) {
			const rows = await this.db
				.select()
				.from(timeSlots)
				.leftJoin(fields, eq(timeSlots.fieldId, fields.id))
				.where(and(...whereParts))
				.orderBy(timeSlots.startUtc);
			return rows.map((r: any) => ({ ...r.time_slots, fieldName: r.fields?.name ?? null }));
		}

		const rows = await this.db
			.select()
			.from(timeSlots)
			.where(and(...whereParts))
			.orderBy(timeSlots.startUtc);
		return rows;
	}
	async findTimeSlotsByDrawSession(drawSessionId: string) {
		const rows = await this.db.query.timeSlots.findMany({
			with: {
				field: true,
				heldByUser: true
			},
			where: eq(timeSlots.drawSessionId, drawSessionId)
		});

		return rows;
	}

	// Legacy method - unassign by slot ID (kept for backward compatibility)
	async unassignSlot(slot: TimeSlot) {
		return this.update({
			...slot,
			heldByUserId: undefined,
			status: 'available'
		});
	}
	// Legacy method - unassign by slot ID (kept for backward compatibility)
	async assignSlot(slot: TimeSlotInsert) {
		if (!slot.heldByUserId) throw new Error('heldByUserId is required');

		return this.update({
			...slot,
			status: 'picked'
		});
	}

	private async update({ id, ...slot }: TimeSlotInsert) {
		if (id) {
			return this.db
				.update(timeSlots)
				.set({
					...slot,
					updatedAt: new Date()
				})
				.where(and(eq(timeSlots.id, id)));
		}
		const [ret] = await this.db
			.insert(timeSlots)
			.values({ ...slot, updatedAt: new Date() })
			.returning();
		return ret;
	}
}
