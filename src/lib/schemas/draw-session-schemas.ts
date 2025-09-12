/**
 * Zod schemas for Draw Sessions and Time Slots
 */

import type { timeSlotStatusEnum } from '$lib/db';
import type {
	drawScheduleSelectSchema,
	drawSessionSelectSchema,
	fieldSelectSchema,
	participantSelectSchema,
	scheduleFieldSelectSchema,
	timeSlotSelectSchema
} from '$lib/db/zod';
import { z } from 'zod/v4';

/**
 * Type exports (inferred from schemas)
 */
export type DrawParticipant = z.infer<typeof participantSelectSchema>;
export type Field = z.infer<typeof fieldSelectSchema>;
export type TimeSlotStatus = z.infer<typeof timeSlotStatusEnum>;
export type TimeSlot = z.infer<typeof timeSlotSelectSchema>;
export type ScheduleField = z.infer<typeof scheduleFieldSelectSchema>;
export type DrawSchedule = z.infer<typeof drawScheduleSelectSchema>;
export type DrawSession = z.infer<typeof drawSessionSelectSchema>;

/**
 * Form action schemas for server-side validation
 */

// Schema for assigning a participant to a time slot
export const assignActionSchema = z.object({
	participantId: z.string().uuid(),
	pattern: z.string(),
	fieldId: z.string().uuid(),
	startUtc: z.string(),
	endUtc: z.string(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	weekday: z.coerce.number().int().min(0).max(6).optional(),
	weekdayName: z.string().optional(),
	isSynthetic: z.coerce.boolean().optional(),
	id: z.string().optional(),
	organizationId: z.string().uuid().optional(),
	drawSessionId: z.string().uuid().optional(),
	status: z.enum(['available', 'held', 'picked', 'blocked']).optional(),
	heldByUserId: z.string().uuid().optional(),
	slot: z.string().optional(),
	version: z.coerce.number().int().optional(),
	holdExpiresAt: z.string().optional(),
	blockedReason: z.string().optional(),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional()
});

// Schema for unassigning a participant from a time slot
export const unassignActionSchema = z.object({
	pattern: z.string(),
	fieldId: z.string().uuid(),
	startUtc: z.string().optional(),
	endUtc: z.string().optional(),
	id: z.string().optional(),
	organizationId: z.string().uuid().optional(),
	drawSessionId: z.string().uuid().optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	weekday: z.coerce.number().int().min(0).max(6).optional(),
	weekdayName: z.string().optional(),
	isSynthetic: z.coerce.boolean().optional(),
	status: z.enum(['available', 'held', 'picked', 'blocked']).optional(),
	heldByUserId: z.string().uuid().optional(),
	slot: z.string().optional(),
	version: z.coerce.number().int().optional(),
	holdExpiresAt: z.string().optional(),
	blockedReason: z.string().optional(),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional()
});

// Schema for picking a time slot
export const pickActionSchema = z.object({
	slotId: z.string().uuid()
});

// Schema for blocking a time slot
export const blockActionSchema = z.object({
	pattern: z.string(),
	fieldId: z.string().uuid(),
	reason: z.string().min(1),
	isSynthetic: z.coerce.boolean().optional(),
	startUtc: z.string().optional(),
	endUtc: z.string().optional(),
	id: z.string().optional(),
	organizationId: z.string().uuid().optional(),
	drawSessionId: z.string().uuid().optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	weekday: z.coerce.number().int().min(0).max(6).optional(),
	weekdayName: z.string().optional(),
	status: z.enum(['available', 'held', 'picked', 'blocked']).optional(),
	heldByUserId: z.string().uuid().optional(),
	slot: z.string().optional(),
	version: z.coerce.number().int().optional(),
	holdExpiresAt: z.string().optional(),
	blockedReason: z.string().optional(),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional()
});

// Schema for unblocking a time slot
export const unblockActionSchema = z.object({
	pattern: z.string(),
	fieldId: z.string().uuid(),
	id: z.string().optional(),
	organizationId: z.string().uuid().optional(),
	drawSessionId: z.string().uuid().optional(),
	startUtc: z.string().optional(),
	endUtc: z.string().optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	weekday: z.coerce.number().int().min(0).max(6).optional(),
	weekdayName: z.string().optional(),
	isSynthetic: z.coerce.boolean().optional(),
	status: z.enum(['available', 'held', 'picked', 'blocked']).optional(),
	heldByUserId: z.string().uuid().optional(),
	slot: z.string().optional(),
	version: z.coerce.number().int().optional(),
	holdExpiresAt: z.string().optional(),
	blockedReason: z.string().optional(),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional()
});

/**
 * Service input validation schemas
 */

// Schema for creating a draw session
export const createDrawSessionInputSchema = z.object({
	organizationId: z.string().uuid(),
	name: z.string().min(1).max(255),
	turnStrategy: z.enum(['fixed', 'randomized', 'snake', 'random', 'round_robin']),
	rounds: z.number().int().min(1).nullable().optional(),
	pickTimeoutSec: z.number().int().min(10).max(3600),
	startsAtUtc: z.date(),
	createdByUserId: z.string().uuid(),
	participants: z
		.array(
			z.object({
				userId: z.string().uuid(),
				role: z.string().optional()
			})
		)
		.min(1)
});

// Schema for updating a draw session
export const updateDrawSessionInputSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	turnStrategy: z.enum(['fixed', 'randomized', 'snake', 'random', 'round_robin']).optional(),
	rounds: z.number().int().min(1).nullable().optional(),
	pickTimeoutSec: z.number().int().min(10).max(3600).optional(),
	startsAtUtc: z.date().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional()
});

// Schema for schedule input
export const scheduleInputSchema = z.object({
	id: z.string().uuid().optional(),
	fieldIds: z.array(z.string().uuid()).min(1),
	recurrence: z.object({
		frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
		interval: z.number().int().min(1),
		weekdays: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
		startDate: z.date(),
		endCondition: z.object({
			type: z.enum(['never', 'onDate', 'afterCount']),
			onDate: z.date().optional(),
			count: z.number().int().min(1).optional()
		}),
		timeWindows: z
			.array(
				z.object({
					start: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
					end: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
				})
			)
			.min(1),
		exceptions: z.array(z.date()).optional(),
		timezone: z.string().optional()
	})
});

// Schema for time slot assignment
export const timeSlotAssignmentSchema = z.object({
	id: z.string().uuid().optional(),
	drawSessionId: z.string().uuid(),
	fieldId: z.string().uuid(),
	pattern: z.string(),
	startUtc: z.string(),
	endUtc: z.string(),
	status: z.enum(['available', 'held', 'picked', 'blocked']),
	heldByUserId: z.string().uuid().optional(),
	roundNumber: z.number().int().min(1).optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
	weekday: z.number().int().min(0).max(6).optional(),
	isSynthetic: z.boolean().optional()
});

// Schema for pick service parameters
export const pickServiceParamsSchema = z.object({
	organizationId: z.string().uuid(),
	sessionId: z.string().uuid(),
	userId: z.string().uuid(),
	timeSlotId: z.string().uuid()
});

// Schema for draw session API requests
export const drawSessionSchema = z.object({
	name: z.string().min(1).max(255),
	turnStrategy: z.enum(['fixed', 'randomized', 'snake', 'random', 'round_robin']),
	startsAtUtc: z.string().datetime(),
	endDate: z.string(),
	participants: z.array(z.string()).min(1),
	schedules: z
		.array(
			z.object({
				fieldIds: z.array(z.string().uuid()).min(1),
				recurrence: z.object({
					frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
					interval: z.number().int().min(1),
					weekdays: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
					timeWindows: z
						.array(
							z.object({
								start: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/),
								end: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
							})
						)
						.min(1)
				})
			})
		)
		.min(1)
});

// Form action types
export type AssignActionData = z.infer<typeof assignActionSchema>;
export type UnassignActionData = z.infer<typeof unassignActionSchema>;
export type PickActionData = z.infer<typeof pickActionSchema>;
export type BlockActionData = z.infer<typeof blockActionSchema>;
export type UnblockActionData = z.infer<typeof unblockActionSchema>;

// Service input types
export type CreateDrawSessionInput = z.infer<typeof createDrawSessionInputSchema>;
export type UpdateDrawSessionInput = z.infer<typeof updateDrawSessionInputSchema>;
export type ScheduleInput = z.infer<typeof scheduleInputSchema>;
export type TimeSlotAssignment = z.infer<typeof timeSlotAssignmentSchema>;
export type PickServiceParams = z.infer<typeof pickServiceParamsSchema>;

// Additional types for compatibility
export type EndCondition = {
	type: 'never' | 'onDate' | 'afterCount';
	onDate?: Date;
	count?: number;
};

export type DrawSessionErrorSchema = {
	name?: string[];
	turnStrategy?: string[];
	participants?: string[];
	schedules?: string[];
};
