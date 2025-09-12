/**
 * Type definitions for Draw Sessions and Time Slots
 */

import type { RecurrenceMulti } from '$lib/components/recurrence/recurrence-utils';

/**
 * Participant in a draw session
 */
export interface DrawParticipant {
	id: string;
	email: string;
	displayName?: string;
	avatarUrl?: string | null;
}

/**
 * Field information
 */
export interface Field {
	id: string;
	name: string;
	description?: string | null;
	location?: string | null;
	capacity?: number | null;
}

/**
 * Field reference in a schedule
 */
export interface ScheduleField {
	id: string;
	fieldId: string;
	field: Field;
}

/**
 * Draw session schedule
 */
export interface DrawSchedule {
	id: string;
	sessionId: string;
	title: string;
	recurrence: RecurrenceMulti;
	fields: ScheduleField[];
}

/**
 * Draw session
 */
export interface DrawSession {
	id: string;
	organizationId: string;
	name: string;
	description?: string | null;
	startDate: Date;
	endDate: Date;
	rounds?: number | null;
	schedules?: DrawSchedule[];
}

/**
 * Time slot status
 */
export type TimeSlotStatus = 'available' | 'held' | 'picked' | 'blocked';

/**
 * Time slot (can be synthetic or persisted)
 */
export interface TimeSlot {
	id: string;
	organizationId: string;
	fieldId: string;
	fieldName: string;
	pattern: string;
	startUtc: string; // ISO string
	endUtc: string; // ISO string
	status: TimeSlotStatus;
	heldByUserId?: string;
	roundNumber?: number; // Which round this slot was picked/assigned in
	participant?: DrawParticipant;
	// Additional properties for synthetic slots and UI display
	startTime?: string; // HH:MM format
	endTime?: string; // HH:MM format
	weekday?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // SU, MO, TU, etc.
	weekdayName?: string; // Sunday, Monday, etc.
	isSynthetic?: boolean; // Whether this is a synthetic slot
	isPattern?: boolean; // Whether this represents a pattern
	heldByUser?: DrawParticipant; // User holding the slot (for DB slots)
	slot?: string; // Unique slot identifier
}

/**
 * Session state with participants
 */
export interface SessionState {
	participants: DrawParticipant[];
	currentRound?: number;
	currentTurn?: string | null;
}

/**
 * Page data for the draw session schedule page
 */
export interface DrawSessionSchedulePageData {
	orgId: string;
	session: DrawSession;
	participants: DrawParticipant[];
	timeSlots: TimeSlot[];
	defaultDateRange: {
		start: string; // ISO string
		end: string; // ISO string
	};
}

/**
 * Form action results
 */
export interface AssignActionResult {
	success?: boolean;
	error?: string;
	slot?: TimeSlot;
}

export interface UnassignActionResult {
	success?: boolean;
	error?: string;
	slot?: TimeSlot;
}
