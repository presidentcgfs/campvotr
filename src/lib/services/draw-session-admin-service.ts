import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import {
	drawSessions,
	drawSessionParticipants,
	drawSchedules,
	drawScheduleFields,
	drawScheduleRules,
	fields,
	organizationMemberships,
	participants
} from '$lib/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { authUsers } from 'drizzle-orm/supabase';
import { type RecurrenceMulti } from '$lib/components/recurrence/recurrence-utils';

export type TurnStrategy = 'random' | 'round_robin' | 'snake';
import type { ParticipantCreate } from '$lib/db/types';

export interface CreateDrawSessionInput {
	name: string;
	turnStrategy: TurnStrategy;
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
	participants: Omit<ParticipantCreate, 'drawSessionId'>[]; // emails or email:role format
	schedules: {
		fieldIds: string[];
		recurrence: RecurrenceMulti;
		rules: { rruleString: string; durationMinutes: number }[];
	}[];
}

export interface CreateDrawSessionResult {
	id: string;
	orgId: string;
	name: string;
	turnStrategy: TurnStrategy;
	startDate: string;
	endDate: string;
	participantsCount: number;
	schedulesCount: number;
	schedules: {
		id: string;
		fieldIds: string[];
		rulesCount: number;
	}[];
	createdAt: Date;
}

export const drawSessionAdminServiceKey =
	pbjKey<DrawSessionAdminService>('drawSessionAdminService');

export class DrawSessionAdminService extends BaseService {
	constructor(db = pbj(drizzleKey)) {
		super(db);
	}

	async createDrawSession(
		input: CreateDrawSessionInput,
		orgId: string,
		userId: string
	): Promise<CreateDrawSessionResult> {
		await this.validateFieldsBelongToOrg(
			[...new Set(input.schedules.flatMap((v) => v.fieldIds))],
			orgId
		);

		return await this.db.transaction(async (tx) => {
			// 1. Create draw session
			const [session] = await tx
				.insert(drawSessions)
				.values({
					organizationId: orgId,
					name: input.name.trim(),
					turnStrategy: input.turnStrategy,
					startDate: input.startDate,
					endDate: input.endDate,
					startsAtUtc: new Date(), // Default to now, can be updated later
					createdByUserId: userId
				})
				.returning();

			// 2. Insert participants
			const participantData = input.participants;
			if (participantData.length > 0) {
				await tx.insert(participants).values(
					participantData.map((p, position) => ({
						drawSessionId: session.id,
						email: p.email,
						role: p.role,
						position
					}))
				);
			}

			// 3. Insert schedules and related data
			const scheduleResults = [];
			for (const schedule of input.schedules) {
				// Insert schedule
				const [scheduleRecord] = await tx
					.insert(drawSchedules)
					.values({
						drawSessionId: session.id,
						recurrence: schedule.recurrence as any,
						timezone: schedule.recurrence.timezone || 'UTC'
					})
					.returning();

				// Insert field mappings
				if (schedule.fieldIds.length > 0) {
					await tx.insert(drawScheduleFields).values(
						schedule.fieldIds.map((fieldId) => ({
							drawScheduleId: scheduleRecord.id,
							fieldId
						}))
					);
				}

				// Insert rules
				if (schedule.rules.length > 0) {
					await tx.insert(drawScheduleRules).values(
						schedule.rules.map((rule) => ({
							drawScheduleId: scheduleRecord.id,
							rruleString: rule.rruleString,
							durationMinutes: rule.durationMinutes
						}))
					);
				}

				scheduleResults.push({
					id: scheduleRecord.id,
					fieldIds: schedule.fieldIds,
					rulesCount: schedule.rules.length
				});
			}

			return {
				id: session.id,
				orgId: session.organizationId,
				name: session.name,
				turnStrategy: session.turnStrategy as TurnStrategy,
				startDate: session.startDate,
				endDate: session.endDate,
				participantsCount: participantData.length,
				schedulesCount: input.schedules.length,
				schedules: scheduleResults,
				createdAt: session.createdAt
			};
		});
	}

	private async validateFieldsBelongToOrg(fieldIds: string[], orgId: string): Promise<void> {
		const orgFields = await this.db
			.select({ id: fields.id })
			.from(fields)
			.where(and(eq(fields.organizationId, orgId), inArray(fields.id, fieldIds)));

		if (orgFields.length !== fieldIds.length) {
			throw new Error('Some fields do not belong to the organization');
		}
	}

	/**
	 * Get all participants for a draw session (both legacy and new systems)
	 */
	async getSessionParticipants(sessionId: string) {
		// Get legacy participants (userId-based)
		return this.db.query.participants.findMany({
			where: eq(participants.drawSessionId, sessionId)
		});
	}

	async setParticipants(
		drawSessionId: string,
		parts: ({ userId: string; role: string } | { email: string; role: string })[]
	) {
		await this.db.transaction(async (tx) => {
			await tx.delete(participants).where(eq(participants.drawSessionId, drawSessionId));
			await tx.insert(participants).values(
				parts.map((p, position) => ({
					drawSessionId,
					position,
					...p
				}))
			);
		});
	}

	/**
	 * Add a participant to a draw session by email
	 */
	async addParticipant(
		sessionId: string,
		orgId: string,
		email: string,
		role: string = 'member',
		position = 0
	) {
		// Validate session belongs to org
		const [session] = await this.db
			.select()
			.from(drawSessions)
			.where(and(eq(drawSessions.id, sessionId), eq(drawSessions.organizationId, orgId)))
			.limit(1);

		if (!session) {
			throw new Error('Session not found or access denied');
		}

		// Check if participant already exists
		const existingLegacy = await this.db
			.select()
			.from(participants)
			.where(and(eq(participants.drawSessionId, sessionId), eq(participants.email, email)))
			.limit(1);

		if (existingLegacy.length > 0) {
			throw new Error('Participant already exists');
		}

		// Try to find if this email is an organization member
		const [orgMember] = await this.db
			.select()
			.from(organizationMemberships)
			.innerJoin(authUsers, eq(organizationMemberships.userId, authUsers.id))
			.where(and(eq(organizationMemberships.organizationId, orgId), eq(authUsers.email, email)))
			.limit(1);

		if (orgMember) {
			// Add as legacy participant (userId-based)
			const [participant] = await this.db
				.insert(participants)
				.values({
					drawSessionId: sessionId,
					userId: orgMember.organization_memberships.userId,
					position, // Will be reordered later if needed
					role
				})
				.returning();
			return { participant, type: 'member' as const };
		} else {
			// Add as email participant
			const [participant] = await this.db
				.insert(participants)
				.values({
					drawSessionId: sessionId,
					email,
					role,
					position
				})
				.returning();
			return { participant, type: 'email' as const };
		}
	}

	/**
	 * Remove a participant from a draw session
	 */
	async removeParticipant(sessionId: string, orgId: string, participantId: string) {
		// Validate session belongs to org
		const [session] = await this.db
			.select()
			.from(drawSessions)
			.where(and(eq(drawSessions.id, sessionId), eq(drawSessions.organizationId, orgId)))
			.limit(1);

		if (!session) {
			throw new Error('Session not found or access denied');
		}

		await this.db
			.delete(participants)
			.where(and(eq(participants.id, participantId), eq(participants.drawSessionId, sessionId)));
	}
}
