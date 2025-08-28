/**
 * Recurrence utilities for rrule-temporal integration
 */

import type { Temporal } from '@js-temporal/polyfill';
import { RRuleTemporal, type RRuleOptions } from 'rrule-temporal';
import { toTemporalInstant } from '@js-temporal/polyfill';
declare global {
	interface Date {
		toTemporalInstant(): Temporal.Instant;
	}
}

Date.prototype.toTemporalInstant = toTemporalInstant;
/**
 * UI-friendly recurrence configuration that gets converted to RRuleTemporalOptions
 */
export type Recurrence = {
	frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
	interval: number; // >= 1
	weekdays?: Array<'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'>; // for weekly
	startDate: Date; // UTC date-only
	endCondition:
		| { type: 'never' }
		| { type: 'onDate'; onDate: Date } // UTC date-only
		| { type: 'afterCount'; count: number }; // >= 1
	timeRange: { start: string; end: string }; // 'HH:mm' 24h, end > start, same day
	exceptions?: Date[]; // UTC dates to exclude (optional)
	timezone?: 'UTC'; // fixed for now; reserved for future
};

export type RRuleTemporalOptions = RRuleOptions;
/**
 * Convert UI Recurrence to rrule-temporal compatible options
 * Note: This returns a simplified options object that can be passed to RRuleTemporal constructor
 */
export function toRRuleTemporalOptions(recurrence: Recurrence): RRuleTemporalOptions {
	// Convert Temporal.Instant to Date for rrule-temporal compatibility
	const startDate = recurrence.startDate.toTemporalInstant().toZonedDateTimeISO('UTC');

	const options: RRuleTemporalOptions = {
		dtstart: startDate,
		freq: recurrence.frequency === 'once' ? 'DAILY' : (recurrence.frequency.toUpperCase() as any),
		interval: Number(recurrence.interval), // Ensure it's a number
		tzid: recurrence.timezone || 'UTC'
	};

	// Handle weekdays for weekly frequency
	if (recurrence.frequency === 'weekly' && recurrence.weekdays?.length) {
		options.byDay = recurrence.weekdays;
	}

	// Handle time range - convert HH:mm to hour/minute arrays
	if (recurrence.timeRange.start && recurrence.timeRange.end) {
		const [startHour, startMinute] = recurrence.timeRange.start.split(':').map(Number);
		const [endHour, endMinute] = recurrence.timeRange.end.split(':').map(Number);

		// Validate hour and minute ranges
		if (startHour >= 0 && startHour <= 23 && startMinute >= 0 && startMinute <= 59) {
			// For single time slot, use specific hour/minute
			if (startHour === endHour && startMinute === endMinute) {
				options.byHour = [startHour];
				options.byMinute = [startMinute];
			} else {
				// For time range, we'll use the start time
				// Note: rrule-temporal doesn't directly support time ranges
				// You may need to generate multiple rules or handle this differently
				options.byHour = [startHour];
				options.byMinute = [startMinute];
			}
		}
	}

	// Handle end conditions
	if (recurrence.endCondition.type === 'afterCount') {
		options.count = Number(recurrence.endCondition.count); // Ensure it's a number
	} else if (recurrence.endCondition.type === 'onDate') {
		// Convert Temporal.Instant to Date
		options.until = recurrence.endCondition.onDate.toTemporalInstant().toZonedDateTimeISO('UTC');
	}

	// Handle exceptions - convert Date[] to proper format
	if (recurrence.exceptions?.length) {
		options.exDate = recurrence.exceptions.map((date) =>
			(date instanceof Date ? date : new Date(date)).toTemporalInstant().toZonedDateTimeISO('UTC')
		);
	}

	// For 'once' frequency, set count to 1
	if (recurrence.frequency === 'once') {
		options.count = 1;
	}

	return options;
}

function toDate(temporal?: Temporal.ZonedDateTime): undefined | Date {
	return temporal != null ? new Date(temporal.toInstant().epochMilliseconds) : undefined;
}
/**
 * Convert rrule-temporal options back to UI Recurrence
 */
export function fromRRuleTemporalOptions(options: RRuleTemporalOptions): Recurrence {
	if ('rruleString' in options) {
		const rrule = new RRuleTemporal(options);
		return fromRRuleTemporalOptions(rrule.options());
	}
	const recurrence: Recurrence = {
		frequency: options.count === 1 ? 'once' : (options.freq.toLowerCase() as any),
		interval: options.interval || 1,
		startDate: toDate(options.dtstart)!,
		endCondition: { type: 'never' },
		timeRange: { start: '09:00', end: '10:00' },
		exceptions: options.exDate?.map((date) => toDate(date)!) || [],
		timezone: (options.tzid as 'UTC') || 'UTC'
	};

	// Handle weekdays
	if (options.byDay?.length) {
		recurrence.weekdays = options.byDay.filter((day) =>
			['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].includes(day)
		) as any;
	}

	// Handle time range
	if (options.byHour?.length && options.byMinute?.length) {
		const hour = options.byHour[0].toString().padStart(2, '0');
		const minute = options.byMinute[0].toString().padStart(2, '0');
		recurrence.timeRange.start = `${hour}:${minute}`;
		// For now, set end time to start + 1 hour as default
		const endHour = (options.byHour[0] + 1) % 24;
		recurrence.timeRange.end = `${endHour.toString().padStart(2, '0')}:${minute}`;
	}

	// Handle end conditions
	if (options.count && options.count > 1) {
		recurrence.endCondition = { type: 'afterCount', count: options.count };
	} else if (options.until) {
		recurrence.endCondition = { type: 'onDate', onDate: toDate(options.until)! };
	}

	return recurrence;
}

/**
 * Validation functions
 */
export function validateTimeRange(start: string, end: string): string | null {
	if (!start || !end) return 'Both start and end times are required';

	const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
	if (!timeRegex.test(start)) return 'Start time must be in HH:mm format';
	if (!timeRegex.test(end)) return 'End time must be in HH:mm format';

	const [startHour, startMinute] = start.split(':').map(Number);
	const [endHour, endMinute] = end.split(':').map(Number);

	const startMinutes = startHour * 60 + startMinute;
	const endMinutes = endHour * 60 + endMinute;

	if (endMinutes <= startMinutes) {
		return 'End time must be after start time';
	}

	return null;
}

export function validateInterval(interval: number): string | null {
	if (!Number.isInteger(interval) || interval < 1) {
		return 'Interval must be a positive integer';
	}
	return null;
}

export function validateCount(count: number): string | null {
	if (!Number.isInteger(count) || count < 1) {
		return 'Count must be a positive integer';
	}
	return null;
}

export function validateWeekdays(weekdays: string[] | undefined, frequency: string): string | null {
	if (frequency === 'weekly' && (!weekdays || weekdays.length === 0)) {
		return 'At least one weekday must be selected for weekly frequency';
	}
	return null;
}

/**
 * Helper function to get human-readable description of recurrence
 */
export function getRecurrenceDescription(recurrence: Recurrence): string {
	const { frequency, interval, weekdays, endCondition } = recurrence;

	let description = '';

	if (frequency === 'once') {
		description = 'One time only';
	} else {
		const unit =
			frequency === 'daily'
				? 'day'
				: frequency === 'weekly'
					? 'week'
					: frequency === 'monthly'
						? 'month'
						: 'year';

		if (interval === 1) {
			description = `Every ${unit}`;
		} else {
			description = `Every ${interval} ${unit}s`;
		}

		if (frequency === 'weekly' && weekdays?.length) {
			const dayNames = {
				MO: 'Monday',
				TU: 'Tuesday',
				WE: 'Wednesday',
				TH: 'Thursday',
				FR: 'Friday',
				SA: 'Saturday',
				SU: 'Sunday'
			};
			const dayList = weekdays.map((day) => dayNames[day]).join(', ');
			description += ` on ${dayList}`;
		}
	}

	// Add end condition
	if (endCondition.type === 'afterCount') {
		description += ` for ${endCondition.count} occurrence${endCondition.count === 1 ? '' : 's'}`;
	} else if (endCondition.type === 'onDate') {
		description += ` until ${endCondition.onDate.toLocaleDateString()}`;
	}

	return description;
}
