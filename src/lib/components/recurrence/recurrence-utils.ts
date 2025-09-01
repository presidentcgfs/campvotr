/**
 * Recurrence utilities for rrule-temporal integration
 */

import { Temporal } from '@js-temporal/polyfill';
import { RRuleTemporal, type RRuleOptions } from 'rrule-temporal';
import { toTemporalInstant } from '@js-temporal/polyfill';

export function toTemporal(date: Date | Temporal.Instant): Temporal.Instant {
	return date instanceof Temporal.Instant ? date : toTemporalInstant.call(toDate(date)!);
}
export function toZonedDateTimeUTC(tdate: Date | Temporal.Instant) {
	const temp = toTemporal(tdate);
	return temp.toZonedDateTimeISO('UTC');
}
/**
 * Weekday type for recurrence rules
 */
export const DayNames = {
	MO: 'Monday',
	TU: 'Tuesday',
	WE: 'Wednesday',
	TH: 'Thursday',
	FR: 'Friday',
	SA: 'Saturday',
	SU: 'Sunday'
} as const;

export type Weekday = keyof typeof DayNames;

/**
 * Time window representing a daily time range
 */
export type TimeWindow = {
	start: string; // 'HH:mm' 24h format, required
	end: string; // 'HH:mm' 24h format, required, end > start (same day only)
};

/**
 * End condition for recurrence rules
 */
export type EndCondition =
	| { type: 'never' }
	| { type: 'onDate'; onDate: Date }
	| { type: 'afterCount'; count: number };

/**
 * Enhanced recurrence configuration supporting multiple time windows
 */
export type RecurrenceMulti = {
	frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
	interval: number; // >= 1
	weekdays?: Weekday[]; // only for weekly
	startDate: Date; // UTC date-only (00:00 UTC)
	endCondition: EndCondition;
	timeWindows: TimeWindow[]; // one or more daily time windows
	exceptions?: Date[]; // optional exclusion dates (UTC date-only)
	timezone?: string; // default 'UTC'
	// Backward compatibility - deprecated, use timeWindows instead
	timeRange?: { start: string; end: string };
};

/**
 * @deprecated Use RecurrenceMulti instead. Kept for backward compatibility.
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
	const startDate = toZonedDateTimeUTC(recurrence.startDate);
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
		options.until = toZonedDateTimeUTC(recurrence.endCondition.onDate);
	}

	// Handle exceptions - convert Date[] to proper format
	if (recurrence.exceptions?.length) {
		options.exDate = recurrence.exceptions.map(toZonedDateTimeUTC);
	}

	// For 'once' frequency, set count to 1
	if (recurrence.frequency === 'once') {
		options.count = 1;
	}

	return options;
}

export function toDate(
	temporal?: Temporal.ZonedDateTime | number | string | Date
): undefined | Date {
	if (!temporal) return undefined;
	if (temporal instanceof Date) {
		return temporal;
	}
	if (typeof temporal === 'string' || typeof temporal === 'number') {
		return new Date(temporal);
	}

	const temp = temporal;

	return new Date(temp.epochMilliseconds);
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
			const dayList = weekdays.map((day) => DayNames[day]).join(', ');
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

// ============================================================================
// NEW MULTI-WINDOW FUNCTIONS
// ============================================================================

/**
 * Result type for toRRules function
 */
export type RRuleResult = {
	rruleString: string; // "DTSTART;TZID=...:YYYYMMDDTHHmmss\nRRULE:..."
	durationMinutes: number; // derived from window end-start; for consumer to build slots
	options?: RRuleTemporalOptions; // optional: the normalized ManualOpts used to build the rule
};

/**
 * Normalize RecurrenceMulti by converting timeRange to timeWindows for backward compatibility
 */
export function normalizeRecurrenceMulti(recurrence: RecurrenceMulti): RecurrenceMulti {
	const normalized = { ...recurrence };

	// If timeWindows is empty but timeRange exists, convert it
	if ((!normalized.timeWindows || normalized.timeWindows.length === 0) && normalized.timeRange) {
		normalized.timeWindows = [normalized.timeRange];
	}

	// Ensure timeWindows exists and has at least one entry
	if (!normalized.timeWindows || normalized.timeWindows.length === 0) {
		throw new Error('At least one time window is required');
	}

	// Sort time windows by start time
	normalized.timeWindows = [...normalized.timeWindows].sort((a, b) => {
		const aStart = a.start.split(':').map(Number);
		const bStart = b.start.split(':').map(Number);
		const aMinutes = aStart[0] * 60 + aStart[1];
		const bMinutes = bStart[0] * 60 + bStart[1];
		return aMinutes - bMinutes;
	});

	return normalized;
}
function parseHHmm(time: string): [number, number] {
	const [hour, minute] = time.split(':').map(Number);
	if (isNaN(hour) || isNaN(minute)) {
		throw new Error(`Invalid time format: ${time}`);
	}
	if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
		throw new Error(`Invalid time value: ${time}`);
	}

	return [hour, minute];
}

/**
 * Convert RecurrenceMulti to multiple rrule-temporal compatible rules (one per time window)
 */
export function toRRules(recurrence: RecurrenceMulti): RRuleResult[] {
	// Normalize timeRange to timeWindows for backward compatibility
	const normalizedRecurrence = normalizeRecurrenceMulti(recurrence);

	if (!normalizedRecurrence.timeWindows.length) {
		throw new Error('At least one time window is required');
	}

	const results: RRuleResult[] = [];
	const timezone = normalizedRecurrence.timezone || 'UTC';

	for (const window of normalizedRecurrence.timeWindows) {
		// Parse time window
		const [startHour, startMinute] = parseHHmm(window.start);
		const [endHour, endMinute] = parseHHmm(window.end);

		// Calculate duration in minutes
		const startTotalMinutes = startHour * 60 + startMinute;
		const endTotalMinutes = endHour * 60 + endMinute;
		const durationMinutes = endTotalMinutes - startTotalMinutes;
		console.dir(
			{
				startHour,
				startMinute,
				endHour,
				endMinute,
				startTotalMinutes,
				endTotalMinutes,
				durationMinutes
			},
			{ depth: 20 }
		);

		if (durationMinutes <= 0) {
			throw new Error(
				`End time must be after start time in window: ${window.start} - ${window.end}`
			);
		}

		// Convert Temporal.Instant to ZonedDateTime for DTSTART
		const startZdt = toZonedDateTimeUTC(normalizedRecurrence.startDate);
		const dtstart = startZdt.with({
			hour: startHour,
			minute: startMinute,
			second: 0,
			millisecond: 0
		});

		// Build rrule options
		const options: RRuleTemporalOptions = {
			dtstart: dtstart,
			freq:
				normalizedRecurrence.frequency === 'once'
					? 'DAILY'
					: (normalizedRecurrence.frequency.toUpperCase() as any),
			interval: Number(normalizedRecurrence.interval),
			tzid: timezone
		};

		// Handle weekdays for weekly frequency
		if (normalizedRecurrence.frequency === 'weekly' && normalizedRecurrence.weekdays?.length) {
			options.byDay = normalizedRecurrence.weekdays;
		}

		// Set time constraints
		options.byHour = [startHour];
		options.byMinute = [startMinute];

		// Handle end conditions
		if (normalizedRecurrence.endCondition.type === 'afterCount') {
			options.count = Number(normalizedRecurrence.endCondition.count);
		} else if (normalizedRecurrence.endCondition.type === 'onDate') {
			// Convert to UTC ZonedDateTime for UNTIL
			options.until = toZonedDateTimeUTC(normalizedRecurrence.endCondition.onDate);
		}

		// For 'once' frequency, set count to 1
		if (normalizedRecurrence.frequency === 'once') {
			options.count = 1;
		}

		// Handle exceptions
		if (normalizedRecurrence.exceptions?.length) {
			options.exDate = normalizedRecurrence.exceptions.map(toZonedDateTimeUTC);
		}

		// Generate rrule string
		const rule = new RRuleTemporal(options);
		const rruleString = rule.toString();

		results.push({
			rruleString,
			durationMinutes,
			options
		});
	}

	return results;
}

/**
 * Validate time windows for overlaps and format issues
 */
export function validateTimeWindows(timeWindows: TimeWindow[]): string | null {
	if (!timeWindows || timeWindows.length === 0) {
		return 'At least one time window is required';
	}

	if (timeWindows.length > 10) {
		return 'Maximum 10 time windows allowed';
	}

	// Validate each window format and end > start
	for (let i = 0; i < timeWindows.length; i++) {
		const window = timeWindows[i];
		const error = validateTimeRange(window.start, window.end);
		if (error) {
			return `Window ${i + 1}: ${error}`;
		}
	}

	// Check for overlaps
	const overlaps = findOverlappingWindows(timeWindows);
	if (overlaps.length > 0) {
		const overlapDescriptions = overlaps.map(
			([i, j]) =>
				`Window ${i + 1} (${timeWindows[i].start}-${timeWindows[i].end}) overlaps with Window ${j + 1} (${timeWindows[j].start}-${timeWindows[j].end})`
		);
		return `Overlapping time windows: ${overlapDescriptions.join(', ')}`;
	}

	return null;
}

/**
 * Find overlapping time windows
 */
export function findOverlappingWindows(timeWindows: TimeWindow[]): Array<[number, number]> {
	const overlaps: Array<[number, number]> = [];

	for (let i = 0; i < timeWindows.length; i++) {
		for (let j = i + 1; j < timeWindows.length; j++) {
			if (timeWindowsOverlap(timeWindows[i], timeWindows[j])) {
				overlaps.push([i, j]);
			}
		}
	}

	return overlaps;
}

/**
 * Check if two time windows overlap
 */
export function timeWindowsOverlap(window1: TimeWindow, window2: TimeWindow): boolean {
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

/**
 * Enhanced description function for RecurrenceMulti
 */
export function getRecurrenceMultiDescription(recurrence: RecurrenceMulti): string {
	const normalized = normalizeRecurrenceMulti(recurrence);
	const { frequency, interval, weekdays, endCondition, timeWindows } = normalized;

	let description = '';

	// Frequency and interval
	if (frequency === 'once') {
		description = 'Once';
	} else if (interval === 1) {
		description = `Every ${frequency.slice(0, -2)}`;
	} else {
		description = `Every ${interval} ${frequency.slice(0, -2)}s`;
	}

	// Weekdays for weekly frequency
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

	// Time windows
	if (timeWindows.length === 1) {
		description += ` at ${timeWindows[0].start}–${timeWindows[0].end}`;
	} else {
		const timeList = timeWindows.map((w) => `${w.start}–${w.end}`).join(' and ');
		description += ` at ${timeList}`;
	}

	// End condition
	if (endCondition.type === 'afterCount') {
		description += ` for ${endCondition.count} occurrence${endCondition.count === 1 ? '' : 's'}`;
	} else if (endCondition.type === 'onDate') {
		description += ` until ${toDate(endCondition.onDate)?.toLocaleDateString()}`;
	}

	return description;
}

/**
 * Time slot with start and end times
 */
export type TimeSlot = {
	start: Date;
	end: Date;
	windowIndex: number; // Which time window this slot came from
};

/**
 * Generate time slots from RecurrenceMulti
 */
export function generateTimeSlotsMulti(recurrence: RecurrenceMulti): TimeSlot[] {
	const rules = toRRules(recurrence);
	const allSlots: TimeSlot[] = [];

	rules.forEach((ruleResult, windowIndex) => {
		try {
			const rule = new RRuleTemporal({ rruleString: ruleResult.rruleString });
			const occurrences = rule.all();

			occurrences.forEach((zdt) => {
				const startTime = new Date(zdt.toInstant().epochMilliseconds);
				const endTime = new Date(startTime.getTime() + ruleResult.durationMinutes * 60 * 1000);

				allSlots.push({
					start: startTime,
					end: endTime,
					windowIndex
				});
			});
		} catch (error) {
			console.error(`Error generating slots for window ${windowIndex}:`, error);
		}
	});

	// Sort by start time
	allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

	return allSlots;
}

/**
 * Convert multiple rrule results back to RecurrenceMulti
 */
export function fromRRules(rules: RRuleResult[]): RecurrenceMulti {
	if (!rules.length) {
		throw new Error('At least one rule is required');
	}

	// Use the first rule as the base for common properties
	const firstRule = new RRuleTemporal({ rruleString: rules[0].rruleString });
	const firstOptions = firstRule.options();

	// Extract time windows from all rules
	const timeWindows: TimeWindow[] = rules.map((ruleResult, index) => {
		try {
			const rule = new RRuleTemporal({ rruleString: ruleResult.rruleString });
			const options = rule.options();

			const startHour = options.byHour?.[0] ?? 0;
			const startMinute = options.byMinute?.[0] ?? 0;

			const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

			// Calculate end time from duration
			const totalStartMinutes = startHour * 60 + startMinute;
			const totalEndMinutes = totalStartMinutes + ruleResult.durationMinutes;
			const endHour = Math.floor(totalEndMinutes / 60);
			const endMinute = totalEndMinutes % 60;
			const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

			return { start: startTime, end: endTime };
		} catch (error) {
			console.error(`Error parsing rule ${index}:`, error);
			return { start: '00:00', end: '01:00' };
		}
	});

	// Build RecurrenceMulti from first rule's options
	const recurrence: RecurrenceMulti = {
		frequency: firstOptions.count === 1 ? 'once' : (firstOptions.freq.toLowerCase() as any),
		interval: firstOptions.interval || 1,
		weekdays: firstOptions.byDay as Weekday[] | undefined,
		startDate: toDate(firstOptions.dtstart)!,
		endCondition: firstOptions.count
			? { type: 'afterCount', count: firstOptions.count }
			: firstOptions.until
				? { type: 'onDate', onDate: toDate(firstOptions.until)! }
				: { type: 'never' },
		timeWindows,
		exceptions: firstOptions.exDate?.map((v) => toDate(v)!) || [],
		timezone: firstOptions.tzid || 'UTC'
	};

	return recurrence;
}
