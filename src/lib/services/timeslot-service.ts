import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import { timeSlots, recurrenceRules, fields } from '$lib/db/schema';
import { and, count, desc, eq, gt, lt, inArray } from 'drizzle-orm';

export interface TimeSlotFilter {
	organizationId: string;
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
	constructor(db = pbj(drizzleKey)) {
		super(db);
	}

	async fetchAvailable(params: TimeSlotFilter, options?: { includeFieldName?: boolean }) {
		const whereParts: any[] = [eq(timeSlots.organizationId, params.organizationId)];
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

	async blockSlot(organizationId: string, timeSlotId: string, reason: string) {
		const [row] = await this.db
			.update(timeSlots)
			.set({ status: 'blocked' as any, blockedReason: reason, updatedAt: new Date() })
			.where(and(eq(timeSlots.organizationId, organizationId), eq(timeSlots.id, timeSlotId)))
			.returning();
		return row ?? null;
	}

	async unblockSlot(organizationId: string, timeSlotId: string) {
		const [row] = await this.db
			.update(timeSlots)
			.set({ status: 'available' as any, blockedReason: null, updatedAt: new Date() })
			.where(and(eq(timeSlots.organizationId, organizationId), eq(timeSlots.id, timeSlotId)))
			.returning();
		return row ?? null;
	}

	async generateFromRule(ruleId: string, slotDurationMinutes: number) {
		const [rule] = await this.db
			.select()
			.from(recurrenceRules)
			.where(eq(recurrenceRules.id, ruleId))
			.limit(1);
		if (!rule) throw new Error('Recurrence rule not found');

		// Simple expansion: interpret byDay for weekly; others use windowStartUtc stepping by interval
		const newSlots: { startUtc: Date; endUtc: Date }[] = [];
		const interval = rule.interval ?? 1;

		const addSlot = (start: Date) => {
			const end = new Date(start.getTime() + slotDurationMinutes * 60_000);
			if (end <= rule.windowEndUtc) newSlots.push({ startUtc: start, endUtc: end });
		};

		if (rule.frequency === 'daily') {
			let cur = new Date(rule.windowStartUtc);
			while (cur <= rule.windowEndUtc) {
				addSlot(new Date(cur));
				cur.setUTCDate(cur.getUTCDate() + interval);
			}
		} else if (rule.frequency === 'weekly') {
			const days = (rule.byDay ?? '').split(',').filter(Boolean);
			let weekStart = new Date(
				Date.UTC(
					rule.windowStartUtc.getUTCFullYear(),
					rule.windowStartUtc.getUTCMonth(),
					rule.windowStartUtc.getUTCDate()
				)
			);
			while (weekStart <= rule.windowEndUtc) {
				for (const d of days) {
					const dayIdx = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(d);
					if (dayIdx < 0) continue;
					const candidate = new Date(weekStart);
					const curDow = candidate.getUTCDay();
					const delta = dayIdx - curDow;
					candidate.setUTCDate(candidate.getUTCDate() + delta);
					if (candidate >= rule.windowStartUtc && candidate <= rule.windowEndUtc)
						addSlot(candidate);
				}
				weekStart.setUTCDate(weekStart.getUTCDate() + 7 * interval);
			}
		} else if (rule.frequency === 'monthly') {
			let cur = new Date(rule.windowStartUtc);
			while (cur <= rule.windowEndUtc) {
				addSlot(new Date(cur));
				cur.setUTCMonth(cur.getUTCMonth() + interval);
			}
		}

		// Insert non-overlapping slots
		let created = 0;
		for (const s of newSlots) {
			const overlaps = await this.db
				.select({ c: count() })
				.from(timeSlots)
				.where(
					and(
						eq(timeSlots.fieldId, rule.fieldId),
						// Overlap if start < existing.end AND end > existing.start
						gt(timeSlots.endUtc, s.startUtc),
						lt(timeSlots.startUtc, s.endUtc)
					)
				);
			if ((overlaps?.[0]?.c ?? 0) > 0) continue;

			await this.db
				.insert(timeSlots)
				.values({
					organizationId: rule.organizationId,
					fieldId: rule.fieldId,
					startUtc: s.startUtc,
					endUtc: s.endUtc,
					status: 'available' as any,
					version: 1
				})
				.onConflictDoNothing();
			created++;
		}

		return { created };
	}

	// List time slots with optional filtering and field name inclusion
	async listTimeSlots(
		organizationId: string,
		options?: {
			startDate?: string;
			endDate?: string;
			fieldId?: string;
			includeFieldName?: boolean;
		}
	) {
		const whereParts: any[] = [eq(timeSlots.organizationId, organizationId)];

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

	// Assign a time slot to a participant
	async assignSlot(organizationId: string, slotId: string, participantId: string) {
		try {
			const [updated] = await this.db
				.update(timeSlots)
				.set({
					assignedParticipantId: participantId,
					status: 'picked' as any,
					updatedAt: new Date()
				})
				.where(
					and(
						eq(timeSlots.id, slotId),
						eq(timeSlots.organizationId, organizationId),
						eq(timeSlots.status, 'available' as any)
					)
				)
				.returning();

			if (!updated) {
				return { error: 'Slot not found or not available' };
			}

			return { slot: updated };
		} catch (error) {
			return { error: 'Failed to assign slot' };
		}
	}

	// Unassign a time slot
	async unassignSlot(organizationId: string, slotId: string) {
		try {
			const [updated] = await this.db
				.update(timeSlots)
				.set({
					assignedParticipantId: null,
					status: 'available' as any,
					updatedAt: new Date()
				})
				.where(and(eq(timeSlots.id, slotId), eq(timeSlots.organizationId, organizationId)))
				.returning();

			if (!updated) {
				return { error: 'Slot not found' };
			}

			return { slot: updated };
		} catch (error) {
			return { error: 'Failed to unassign slot' };
		}
	}

	// Bulk validate against overlaps and create provided slots
	async bulkCreateIfValid(
		organizationId: string,
		slots: { fieldId: string; startUtc: Date; endUtc: Date }[]
	): Promise<{ created: number; error?: string }> {
		// Validate overlaps per slot against DB
		for (const s of slots) {
			const overlaps = await this.db
				.select({ c: count() })
				.from(timeSlots)
				.where(
					and(
						eq(timeSlots.organizationId, organizationId),
						eq(timeSlots.fieldId, s.fieldId),
						gt(timeSlots.endUtc, s.startUtc),
						lt(timeSlots.startUtc, s.endUtc)
					)
				);
			if ((overlaps?.[0]?.c ?? 0) > 0)
				return { created: 0, error: 'One or more time slots overlap existing slots' };
		}

		let created = 0;
		for (const s of slots) {
			await this.db
				.insert(timeSlots)
				.values({
					organizationId,
					fieldId: s.fieldId,
					startUtc: s.startUtc,
					endUtc: s.endUtc,
					status: 'available' as any,
					version: 1
				})
				.onConflictDoNothing();
			created++;
		}
		return { created };
	}

	// Expand and validate per-field schedules to concrete slots (UTC). Pure logic — exported for tests.
	expandFieldSchedules(input: FieldSchedulesInput[]): {
		prepared: { fieldId: string; startUtc: Date; endUtc: Date }[];
		perFieldCount: Record<string, number>;
		error?: string;
	} {
		const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
		const timeRe = /^\d{2}:\d{2}$/;
		const toMinutes = (hhmm: string) => {
			const [h, m] = hhmm.split(':').map((n) => Number(n));
			return h * 60 + m;
		};
		const prepared: { fieldId: string; startUtc: Date; endUtc: Date }[] = [];
		const perFieldCount: Record<string, number> = {};
		for (const fs of input) {
			if (!fs.fieldId) return { prepared: [], perFieldCount: {}, error: 'Missing fieldId' };
			// Validate windows no-overlap within a single schedule day-wise
			for (const sch of fs.schedules || []) {
				if (!sch.startDate || !sch.endDate)
					return {
						prepared: [],
						perFieldCount: {},
						error: 'Start and end dates are required (UTC)'
					};
				if (!Array.isArray(sch.windows) || sch.windows.length === 0)
					return {
						prepared: [],
						perFieldCount: {},
						error: 'Each Field schedule needs at least one window'
					};
				const mins = sch.windows.map((w) => {
					const st = (w.startTime || '').trim();
					const en = (w.endTime || '').trim();
					if (!timeRe.test(st) || !timeRe.test(en)) return { stMin: NaN, enMin: NaN } as any;
					const stMin = toMinutes(st);
					const enMin = toMinutes(en);
					return { stMin, enMin };
				});
				if (mins.some((m) => !(m.enMin > m.stMin)))
					return {
						prepared: [],
						perFieldCount: {},
						error: 'End time must be after start time (same UTC day)'
					};
				mins.sort((a, b) => a.stMin - b.stMin);
				for (let i = 1; i < mins.length; i++)
					if (mins[i - 1].enMin > mins[i].stMin)
						return {
							prepared: [],
							perFieldCount: {},
							error: 'Time windows overlap within a schedule for a Field'
						};
				// Expand across dates for selected days
				const daySet = new Set((sch.days || []).filter(Boolean));
				if (daySet.size === 0)
					return { prepared: [], perFieldCount: {}, error: 'Select at least one day of week' };
				const startDate = new Date(`${sch.startDate}T00:00:00Z`);
				const endDate = new Date(`${sch.endDate}T00:00:00Z`);
				if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate)
					return {
						prepared: [],
						perFieldCount: {},
						error: 'End date must be on or after start date (UTC)'
					};
				for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
					const code = DAY_CODES[d.getUTCDay()];
					if (!daySet.has(code)) continue;
					for (const w of mins) {
						const startUtc = new Date(
							Date.UTC(
								d.getUTCFullYear(),
								d.getUTCMonth(),
								d.getUTCDate(),
								Math.floor(w.stMin / 60),
								w.stMin % 60
							)
						);
						const endUtc = new Date(
							Date.UTC(
								d.getUTCFullYear(),
								d.getUTCMonth(),
								d.getUTCDate(),
								Math.floor(w.enMin / 60),
								w.enMin % 60
							)
						);
						if (!(startUtc < endUtc))
							return {
								prepared: [],
								perFieldCount: {},
								error: 'Each slot must have Start < End (UTC same-day)'
							};
						prepared.push({ fieldId: fs.fieldId, startUtc, endUtc });
					}
				}
			}
			perFieldCount[fs.fieldId] = prepared.filter((p) => p.fieldId === fs.fieldId).length;
		}
		// Check overlaps among prepared slots per field (same request)
		const byField: Record<string, { startUtc: Date; endUtc: Date }[]> = {};
		for (const s of prepared) {
			(byField[s.fieldId] ||= []).push({ startUtc: s.startUtc, endUtc: s.endUtc });
		}
		for (const fid of Object.keys(byField)) {
			const arr = byField[fid].sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime());
			for (let i = 1; i < arr.length; i++) {
				if (arr[i - 1].endUtc > arr[i].startUtc) {
					return {
						prepared: [],
						perFieldCount: {},
						error: 'Generated windows overlap within the same Field'
					};
				}
			}
		}
		return { prepared, perFieldCount };
	}

	// Validate against DB (no overlaps) and create from per-field schedules. Caps total at 500.
	async createFromFieldSchedules(
		organizationId: string,
		input: FieldSchedulesInput[],
		cap: number = 500
	): Promise<{ total: number; perField: { fieldId: string; count: number }[]; error?: string }> {
		const { prepared, perFieldCount, error } = this.expandFieldSchedules(input);
		if (error) return { total: 0, perField: [], error };
		if (prepared.length > cap)
			return { total: 0, perField: [], error: `Too many generated time slots (max ${cap})` };
		const { created, error: dbError } = await this.bulkCreateIfValid(organizationId, prepared);
		if (dbError) return { total: 0, perField: [], error: dbError };
		if (created !== prepared.length)
			return { total: created, perField: [], error: 'Failed to create all time slots' };
		const perField = Object.entries(perFieldCount).map(([fieldId, count]) => ({ fieldId, count }));
		return { total: created, perField };
	}
}
