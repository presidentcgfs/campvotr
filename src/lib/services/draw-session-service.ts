import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import {
	drawScheduleFields,
	drawSchedules,
	drawSessions,
	participants,
	picks
} from '$lib/db/schema';
import { and, asc, count, desc, eq, sql, inArray } from 'drizzle-orm';
import { calculateCurrentTurn, type Participant } from './turn-order';
import {
	validateTimeWindows,
	generateTimeSlotsMulti,
	type RecurrenceMulti,
	type TimeSlot,
	toDate
} from '$lib/components/recurrence/recurrence-utils';
import { randomUUID } from 'crypto';
import type { DrawParticipant, DrawSession } from '$lib/db/zod';
import {
	createDrawSessionInputSchema,
	updateDrawSessionInputSchema,
	scheduleInputSchema,
	type CreateDrawSessionInput,
	type UpdateDrawSessionInput,
	type ScheduleInput
} from '$lib/db/zod';
import { dayNames } from '$lib/components/schedules/util';
import { Temporal } from '@js-temporal/polyfill';
import { RRuleTemporal } from 'rrule-temporal';
import { type DrawSession as DrawSessionValidated } from '$lib/services/validate';

export type TurnStrategy = 'fixed' | 'randomized' | 'snake' | 'random' | 'round_robin';
export type SessionStatus = 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Schedule {
	id: string;
	drawSessionId: string;
	fieldIds: string[];
	recurrence: RecurrenceMulti;
	timezone: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface DrawSessionWithSchedules {
	id: string;
	organizationId: string;
	name: string;
	status: SessionStatus;
	turnStrategy: TurnStrategy;
	rounds: number | null;
	pickTimeoutSec: number;
	startsAtUtc: Date;
	startDate: Date;
	endDate: Date;
	createdByUserId: string;
	createdAt: Date;
	updatedAt: Date;
	schedules: Schedule[];
}

export const drawSessionServiceKey = pbjKey<DrawSessionService>('drawSessionService');
export class DrawSessionService extends BaseService {
	constructor(db = pbj(drizzleKey)) {
		super(db);
	}

	async loadSession(sessionId: string) {
		const session = await this.db.query.drawSessions.findFirst({
			where: eq(drawSessions.id, sessionId),
			with: {
				schedules: {
					with: {
						fields: {
							with: {
								field: true
							}
						}
					}
				},
				timeSlots: {
					with: {
						heldByUser: true,
						field: true
					}
				},
				participants: true
			}
		});
		return session;
	}

	async createSession(input: CreateDrawSessionInput) {
		// Validate input using zod schema
		const validatedInput = createDrawSessionInputSchema.parse(input);

		const [session] = await this.db
			.insert(drawSessions)
			.values({
				organizationId: validatedInput.organizationId,
				name: validatedInput.name,
				turnStrategy: validatedInput.turnStrategy,
				rounds: validatedInput.rounds ?? null,
				pickTimeoutSec: validatedInput.pickTimeoutSec,
				startsAtUtc: validatedInput.startsAtUtc,
				createdByUserId: validatedInput.createdByUserId,
				status: 'scheduled'
			} as any)
			.returning();

		// Seed participants with positions; if randomized, we can shuffle here
		const list = [...input.participants];
		if (input.turnStrategy === 'randomized') {
			for (let i = list.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[list[i], list[j]] = [list[j], list[i]];
			}
		}

		let pos = 1;
		for (const p of list) {
			await this.db.insert(participants).values({
				drawSessionId: session.id,
				userId: p.userId,
				position: pos++,
				role: p.role ?? 'participant'
			});
		}

		return session;
	}

	async updateStatus(organizationId: string, sessionId: string, status: SessionStatus) {
		const [row] = await this.db
			.update(drawSessions)
			.set({ status, updatedAt: new Date() })
			.where(and(eq(drawSessions.organizationId, organizationId), eq(drawSessions.id, sessionId)))
			.returning();
		return row ?? null;
	}

	async updateSession(
		organizationId: string,
		drawSessionId: string,
		{ schedules, participants: parts, ...input }: DrawSessionValidated
	): Promise<DrawSessionWithSchedules> {
		const updateData = {
			...input,
			updatedAt: new Date()
		};

		return this.db.transaction(async (tx) => {
			// Update the session
			const [session] = await tx
				.update(drawSessions)
				.set(updateData)
				.where(
					and(eq(drawSessions.organizationId, organizationId), eq(drawSessions.id, drawSessionId))
				)
				.returning();

			if (!session) {
				throw new Error('Session not found or access denied');
			}

			// Update participants
			await tx.delete(participants).where(eq(participants.drawSessionId, drawSessionId));
			await tx.insert(participants).values(
				parts.map((p, position) => ({
					drawSessionId,
					position,
					...p
				}))
			);

			// Handle schedules upsert
			const finalSchedules = await this.upsertSchedules(
				tx,
				organizationId,
				drawSessionId,
				schedules
			);

			return {
				...session,
				schedules: finalSchedules
			};
		});
	}

	async fetchSessionState(organizationId: string, sessionId: string) {
		const [session] = await this.db
			.select()
			.from(drawSessions)
			.where(and(eq(drawSessions.organizationId, organizationId), eq(drawSessions.id, sessionId)))
			.limit(1);
		if (!session) return null;

		const people = await this.db
			.select()
			.from(participants)
			.where(eq(participants.drawSessionId, session.id))
			.orderBy(asc(participants.position));

		const existingPicks = await this.db
			.select()
			.from(picks)
			.where(eq(picks.drawSessionId, session.id))
			.orderBy(asc(picks.roundNumber), asc(picks.turnNumber));

		return { session, participants: people, picks: existingPicks };
	}

	async computeCurrentTurn(organizationId: string, sessionId: string) {
		// Returns { roundNumber, turnNumber, participantId } for any turn strategy
		const state = await this.fetchSessionState(organizationId, sessionId);
		if (!state) throw new Error('Session not found');

		const totalPrev = state.picks.length;
		const participantsData: Participant[] = state.participants.map((p) => ({
			id: p.id,
			position: p.position
		}));

		const turn = calculateCurrentTurn(
			state.session.turnStrategy as any,
			participantsData,
			totalPrev,
			state.session.rounds,
			Infinity // No slot limit for individual turn calculation
		);

		if (!turn) throw new Error('No more turns available');

		return turn;
	}

	// Backward compatibility method
	async computeFixedTurn(organizationId: string, sessionId: string) {
		return this.computeCurrentTurn(organizationId, sessionId);
	}
	async listSessions(organizationId: string) {
		const rows = await this.db
			.select()
			.from(drawSessions)
			.where(eq(drawSessions.organizationId, organizationId))
			.orderBy(desc(drawSessions.createdAt));
		return rows;
	}

	async getUserSessions(organizationId: string, userId: string, userEmail: string) {
		// Get sessions where user is a participant (either by userId or email)
		// First, get sessions from the participants table (older system)
		const sessionsByUserId = await this.db
			.select({
				id: drawSessions.id,
				name: drawSessions.name,
				status: drawSessions.status,
				turnStrategy: drawSessions.turnStrategy,
				rounds: drawSessions.rounds,
				pickTimeoutSec: drawSessions.pickTimeoutSec,
				startsAtUtc: drawSessions.startsAtUtc,
				startDate: drawSessions.startDate,
				endDate: drawSessions.endDate,
				createdAt: drawSessions.createdAt,
				updatedAt: drawSessions.updatedAt,
				participantCount: count(participants.id)
			})
			.from(drawSessions)
			.innerJoin(participants, eq(participants.drawSessionId, drawSessions.id))
			.where(and(eq(drawSessions.organizationId, organizationId), eq(participants.userId, userId)))
			.groupBy(drawSessions.id)
			.orderBy(
				// Open draws first (active, scheduled), then others
				desc(
					sql`CASE
						WHEN ${drawSessions.status} IN ('active', 'scheduled') THEN 1
						ELSE 0
					END`
				),
				desc(drawSessions.createdAt)
			);

		// Then get sessions from the participants table by email (newer system)
		const sessionsByEmail = await this.db
			.select({
				id: drawSessions.id,
				name: drawSessions.name,
				status: drawSessions.status,
				turnStrategy: drawSessions.turnStrategy,
				rounds: drawSessions.rounds,
				pickTimeoutSec: drawSessions.pickTimeoutSec,
				startsAtUtc: drawSessions.startsAtUtc,
				startDate: drawSessions.startDate,
				endDate: drawSessions.endDate,
				createdAt: drawSessions.createdAt,
				updatedAt: drawSessions.updatedAt,
				participantCount: count(participants.id)
			})
			.from(drawSessions)
			.innerJoin(participants, eq(participants.drawSessionId, drawSessions.id))
			.where(
				and(eq(drawSessions.organizationId, organizationId), eq(participants.email, userEmail))
			)
			.groupBy(drawSessions.id)
			.orderBy(
				// Open draws first (active, scheduled), then others
				desc(
					sql`CASE
						WHEN ${drawSessions.status} IN ('active', 'scheduled') THEN 1
						ELSE 0
					END`
				),
				desc(drawSessions.createdAt)
			);

		// Combine and deduplicate results
		const allSessions = [...sessionsByUserId, ...sessionsByEmail];
		const uniqueSessions = allSessions.reduce(
			(acc, session) => {
				if (!acc.find((s: any) => s.id === session.id)) {
					acc.push(session);
				}
				return acc;
			},
			[] as typeof allSessions
		);

		// Re-sort the combined results
		return uniqueSessions.sort((a: any, b: any) => {
			// Open draws first
			const aIsOpen = ['active', 'scheduled'].includes(a.status);
			const bIsOpen = ['active', 'scheduled'].includes(b.status);
			if (aIsOpen && !bIsOpen) return -1;
			if (!aIsOpen && bIsOpen) return 1;

			// Then by creation date
			return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		});
	}

	/**
	 * Upsert schedules for a draw session within a transaction
	 * Handles create/update/delete operations based on presence of IDs
	 */
	private async upsertSchedules(
		tx: any,
		_organizationId: string,
		drawSessionId: string,
		inputSchedules: ScheduleInput[]
	): Promise<Schedule[]> {
		// Validate input schedules
		this.validateSchedules(inputSchedules);

		// Get existing schedules for this session
		const existingSchedules = await tx
			.select()
			.from(drawSchedules)
			.where(eq(drawSchedules.drawSessionId, drawSessionId));

		const existingScheduleIds = new Set(existingSchedules.map((s: any) => s.id));
		const inputScheduleIds = new Set(
			inputSchedules.filter((s: any) => s.id).map((s: any) => s.id!)
		);

		// Check for duplicate IDs in input
		const inputIds = inputSchedules.filter((s: any) => s.id).map((s: any) => s.id!);
		if (inputIds.length !== new Set(inputIds).size) {
			throw new Error('Duplicate schedule IDs in input');
		}

		// Check for invalid update attempts (ID provided but doesn't exist)
		for (const schedule of inputSchedules) {
			if ((schedule as any).id && !existingScheduleIds.has((schedule as any).id)) {
				throw new Error(`Schedule with ID ${(schedule as any).id} not found for this session`);
			}
		}

		// Determine operations
		const toCreate = inputSchedules.filter((s: any) => !s.id);
		const toUpdate = inputSchedules.filter((s: any) => s.id);
		const toDeleteIds = Array.from(existingScheduleIds).filter((id) => !inputScheduleIds.has(id));

		// Delete schedules not in input
		if (toDeleteIds.length > 0) {
			await tx
				.delete(drawScheduleFields)
				.where(inArray(drawScheduleFields.drawScheduleId, toDeleteIds as string[]));
			await tx.delete(drawSchedules).where(inArray(drawSchedules.id, toDeleteIds as string[]));
		}

		const finalSchedules: Schedule[] = [];

		// Create new schedules
		for (const schedule of toCreate) {
			const scheduleId = randomUUID();
			const now = new Date();

			const [createdSchedule] = await tx
				.insert(drawSchedules)
				.values({
					id: scheduleId,
					drawSessionId,
					recurrence: schedule.recurrence,
					timezone: schedule.recurrence.timezone || 'UTC',
					createdAt: now,
					updatedAt: now
				})
				.returning();

			// Create field associations
			if ((schedule as any).fieldIds.length > 0) {
				await tx.insert(drawScheduleFields).values(
					(schedule as any).fieldIds.map((fieldId: string) => ({
						drawScheduleId: scheduleId,
						fieldId,
						createdAt: now
					}))
				);
			}

			finalSchedules.push({
				...createdSchedule,
				fieldIds: schedule.fieldIds
			});
		}

		// Update existing schedules
		for (const schedule of toUpdate) {
			const now = new Date();

			const [updatedSchedule] = await tx
				.update(drawSchedules)
				.set({
					recurrence: schedule.recurrence,
					timezone: schedule.recurrence.timezone || 'UTC',
					updatedAt: now
				})
				.where(eq(drawSchedules.id, (schedule as any).id!))
				.returning();

			// Update field associations - delete and recreate
			await tx
				.delete(drawScheduleFields)
				.where(eq(drawScheduleFields.drawScheduleId, (schedule as any).id!));

			if ((schedule as any).fieldIds.length > 0) {
				await tx.insert(drawScheduleFields).values(
					schedule.fieldIds.map((fieldId: string) => ({
						drawScheduleId: schedule.id,
						fieldId,
						createdAt: now
					}))
				);
			}

			finalSchedules.push({
				...updatedSchedule,
				fieldIds: (schedule as any).fieldIds
			});
		}

		return finalSchedules;
	}

	/**
	 * Validate schedules for overlaps and constraints
	 */
	private validateSchedules(schedules: any[]): void {
		if (schedules.length === 0) return;

		// Check for overlaps within the same field across schedules
		const fieldTimeWindows = new Map<
			string,
			Array<{ start: string; end: string; scheduleIndex: number }>
		>();

		schedules.forEach((schedule: any, scheduleIndex) => {
			// Validate time windows within this schedule
			const timeWindowError = validateTimeWindows(schedule.recurrence.timeWindows);
			if (timeWindowError) {
				throw new Error(`Schedule ${scheduleIndex + 1}: ${timeWindowError}`);
			}

			// Collect time windows by field for cross-schedule overlap checking
			schedule.fieldIds.forEach((fieldId: string) => {
				if (!fieldTimeWindows.has(fieldId)) {
					fieldTimeWindows.set(fieldId, []);
				}
				schedule.recurrence.timeWindows.forEach((window: any) => {
					fieldTimeWindows.get(fieldId)!.push({
						...window,
						scheduleIndex
					});
				});
			});
		});

		// Check for overlaps across schedules within the same field
		for (const [fieldId, windows] of fieldTimeWindows) {
			for (let i = 0; i < windows.length; i++) {
				for (let j = i + 1; j < windows.length; j++) {
					const window1 = windows[i];
					const window2 = windows[j];

					// Only check overlaps between different schedules
					if (window1.scheduleIndex !== window2.scheduleIndex) {
						if (this.timeWindowsOverlap(window1, window2)) {
							throw new Error(
								`Time window overlap detected in field ${fieldId} between schedules ${window1.scheduleIndex + 1} and ${window2.scheduleIndex + 1}: ${window1.start}-${window1.end} overlaps with ${window2.start}-${window2.end}`
							);
						}
					}
				}
			}
		}

		// Validate total slot count doesn't exceed 500
		let totalSlots = 0;
		for (const schedule of schedules) {
			try {
				const slots = generateTimeSlotsMulti((schedule as any).recurrence);
				totalSlots += slots.length * (schedule as any).fieldIds.length;
			} catch (error) {
				throw new Error(`Error generating slots for schedule: ${error}`);
			}
		}

		if (totalSlots > 500) {
			throw new Error(`Total generated slots (${totalSlots}) exceeds maximum limit of 500`);
		}
	}

	/**
	 * Check if two time windows overlap
	 */
	private timeWindowsOverlap(
		window1: { start: string; end: string },
		window2: { start: string; end: string }
	): boolean {
		const [start1Hour, start1Minute] = window1.start.split(':').map(Number);
		const [end1Hour, end1Minute] = window1.end.split(':').map(Number);
		const [start2Hour, start2Minute] = window2.start.split(':').map(Number);
		const [end2Hour, end2Minute] = window2.end.split(':').map(Number);

		const start1Minutes = start1Hour * 60 + start1Minute;
		const end1Minutes = end1Hour * 60 + end1Minute;
		const start2Minutes = start2Hour * 60 + start2Minute;
		const end2Minutes = end2Hour * 60 + end2Minute;

		// Two ranges overlap if: start1 < end2 AND start2 < end1
		return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
	}
}
