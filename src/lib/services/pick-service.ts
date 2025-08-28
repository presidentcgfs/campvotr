import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import { drawSessions, participants, picks, timeSlots } from '$lib/db/schema';
import { and, count, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { DrawSessionService, drawSessionServiceKey } from './draw-session-service';

export const pickServiceKey = pbjKey<PickService>('pickService');
export class PickService extends BaseService {
	private drawSvc: DrawSessionService;

	constructor(drawSvc = pbj(drawSessionServiceKey), db = pbj(drizzleKey)) {
		super(db);
		this.drawSvc = drawSvc;
	}

	// Attempts a pick with optimistic concurrency. Returns { success: true } or throws 409.
	async performPick(params: {
		organizationId: string;
		sessionId: string;
		userId: string;
		timeSlotId: string;
	}) {
		const { organizationId, sessionId, userId, timeSlotId } = params;

		// Validate session is active
		const [session] = await this.db
			.select({ id: drawSessions.id, status: drawSessions.status })
			.from(drawSessions)
			.where(and(eq(drawSessions.organizationId, organizationId), eq(drawSessions.id, sessionId)))
			.limit(1);
		if (!session) throw new Error('Session not found');
		if (session.status !== 'active') throw new Error('Session not active');

		// Validate participant and turn (fixed/basic). TODO: snake/randomized support.
		const state = await this.drawSvc.fetchSessionState(organizationId, sessionId);
		if (!state) throw new Error('Session not found');
		const participant = state.participants.find((p) => p.userId === userId);
		if (!participant) throw new Error('Not a participant');

		const { roundNumber, turnNumber, participantId } = await this.drawSvc.computeFixedTurn(
			organizationId,
			sessionId
		);
		if (participant.id !== participantId) {
			throw new Error('Not your turn');
		}

		// Optimistic status transition: available -> picked if no hold or hold expired
		const now = new Date();
		const updated = await this.db
			.update(timeSlots)
			.set({
				status: 'picked' as any,
				version: sql`${timeSlots.version} + 1`,
				updatedAt: now
			})
			.where(
				and(
					eq(timeSlots.id, timeSlotId),
					eq(timeSlots.organizationId, organizationId),
					eq(timeSlots.status, 'available' as any),
					or(isNull(timeSlots.holdExpiresAt), lt(timeSlots.holdExpiresAt as any, now))
				)
			)
			.returning({ id: timeSlots.id });

		if (!updated.length) {
			const conflict = new Response('Slot already picked', { status: 409 });
			// Throwing Response to be handled by route helpers
			throw conflict as any;
		}

		await this.db.insert(picks).values({
			drawSessionId: sessionId,
			participantId: participant.id,
			timeSlotId,
			roundNumber,
			turnNumber
		});

		return { success: true, roundNumber, turnNumber };
	}
}
