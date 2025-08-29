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
	organizationMemberships
} from '$lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import {
	type RecurrenceMulti,
	toRRules,
	validateRecurrenceMulti,
	generateTimeSlotsMulti
} from '$lib/components/recurrence/recurrence-utils';

export type TurnStrategy = 'random' | 'round_robin' | 'snake';

export interface CreateDrawSessionInput {
	name: string;
	turnStrategy: TurnStrategy;
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
	participants: string[]; // emails or email:role format
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
			const participantData = this.parseParticipants(input.participants);
			if (participantData.length > 0) {
				await tx.insert(drawSessionParticipants).values(
					participantData.map((p) => ({
						drawSessionId: session.id,
						email: p.email,
						role: p.role
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

	private parseParticipants(participants: string[]): { email: string; role: string }[] {
		return participants.map((p) => {
			const trimmed = p.trim().toLowerCase();
			if (trimmed.includes(':')) {
				const [email, role] = trimmed.split(':', 2);
				return { email: email.trim(), role: role.trim() || 'member' };
			}
			return { email: trimmed, role: 'member' };
		});
	}

	private async validateParticipantsAreOrgMembers(emails: string[], orgId: string): Promise<void> {
		if (emails.length === 0) return;

		const members = await this.db
			.select({ email: organizationMemberships.userId }) // This would need to be joined with auth.users
			.from(organizationMemberships)
			.where(eq(organizationMemberships.organizationId, orgId));

		// For now, we'll skip this validation since we don't have direct access to auth.users
		// In a real implementation, you'd join with the users table or use a separate service
		// TODO: Implement proper email validation against org membership
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
}
