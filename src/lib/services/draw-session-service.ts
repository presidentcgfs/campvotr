import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import {
	drawScheduleFields,
	drawSchedules,
	drawSessions,
	fields,
	participants,
	picks
} from '$lib/db/schema';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { calculateCurrentTurn, type Participant } from './turn-order';

export type TurnStrategy = 'fixed' | 'randomized' | 'snake' | 'random' | 'round_robin';
export type SessionStatus = 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface CreateDrawSessionInput {
	organizationId: string;
	name: string;
	turnStrategy: TurnStrategy;
	rounds?: number | null;
	pickTimeoutSec: number;
	startsAtUtc: Date;
	createdByUserId: string;
	participants: { userId: string; role?: string }[];
}

export interface UpdateDrawSessionInput {
	name?: string;
	turnStrategy?: TurnStrategy;
	rounds?: number | null;
	pickTimeoutSec?: number;
	startsAtUtc?: Date;
	startDate?: string;
	endDate?: string;
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
				}
			}
		});
		return session;
	}

	async createSession(input: CreateDrawSessionInput) {
		const [session] = await this.db
			.insert(drawSessions)
			.values({
				organizationId: input.organizationId,
				name: input.name,
				turnStrategy: input.turnStrategy,
				rounds: input.rounds ?? null,
				pickTimeoutSec: input.pickTimeoutSec,
				startsAtUtc: input.startsAtUtc,
				createdByUserId: input.createdByUserId,
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

	async updateSession(organizationId: string, sessionId: string, input: UpdateDrawSessionInput) {
		const updateData: any = { updatedAt: new Date() };

		if (input.name !== undefined) updateData.name = input.name;
		if (input.turnStrategy !== undefined) updateData.turnStrategy = input.turnStrategy;
		if (input.rounds !== undefined) updateData.rounds = input.rounds;
		if (input.pickTimeoutSec !== undefined) updateData.pickTimeoutSec = input.pickTimeoutSec;
		if (input.startsAtUtc !== undefined) updateData.startsAtUtc = input.startsAtUtc;
		if (input.startDate !== undefined) updateData.startDate = input.startDate;
		if (input.endDate !== undefined) updateData.endDate = input.endDate;

		const [row] = await this.db
			.update(drawSessions)
			.set(updateData)
			.where(and(eq(drawSessions.organizationId, organizationId), eq(drawSessions.id, sessionId)))
			.returning();
		return row ?? null;
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
}
