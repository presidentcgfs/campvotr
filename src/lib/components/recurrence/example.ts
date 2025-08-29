import { RRuleTemporal } from 'rrule-temporal';
import {
	toRRules,
	fromRRules,
	generateTimeSlotsMulti,
	type RecurrenceMulti,
	type Recurrence
} from './recurrence-utils.js';
import { Temporal, Intl, toTemporalInstant } from '@js-temporal/polyfill';
declare global {
	interface Date {
		toTemporalInstant(): Temporal.Instant;
	}
}

Date.prototype.toTemporalInstant = toTemporalInstant;
/**
 * Example usage of RecurrencePicker with rrule-temporal library using RecurrenceMulti
 */

// Example 1: Weekly recurrence with multiple time windows
const weeklyRecurrenceMulti: RecurrenceMulti = {
	frequency: 'weekly',
	interval: 1,
	weekdays: ['TU', 'TH'],
	startDate: new Date('2025-01-01T14:30:00.000Z').toTemporalInstant(),
	endCondition: { type: 'afterCount', count: 10 },
	timeWindows: [
		{ start: '09:00', end: '10:00' },
		{ start: '14:30', end: '15:30' }
	],
	exceptions: [],
	timezone: 'UTC'
};

// Convert to multiple rrule strings
const rules = toRRules(weeklyRecurrenceMulti);
console.log('Generated Rules:', rules);

// Generate time slots with start/end times
const timeSlots = generateTimeSlotsMulti(weeklyRecurrenceMulti);
console.log('Generated time slots:', timeSlots.slice(0, 5)); // Show first 5

// Example 2: Daily recurrence ending on a specific date
const dailyRecurrence: Recurrence = {
	frequency: 'daily',
	interval: 2, // every 2 days
	startDate: new Date('2025-01-01T09:00:00.000Z'),
	endCondition: { type: 'onDate', onDate: new Date('2025-01-31T23:59:59.999Z') },
	timeRange: { start: '09:00', end: '10:00' },
	exceptions: [new Date('2025-01-15T09:00:00.000Z')], // skip Jan 15th
	timezone: 'UTC'
};

const dailyRule = new RRuleTemporal(toRRuleTemporalOptions(dailyRecurrence));
const dailyOccurrences = dailyRule.all();
console.log('Daily occurrences:', dailyOccurrences.length);

// Example 3: Monthly recurrence on the 15th of each month
const monthlyRecurrence: Recurrence = {
	frequency: 'monthly',
	interval: 1,
	startDate: new Date('2025-01-15T10:00:00.000Z'),
	endCondition: { type: 'never' },
	timeRange: { start: '10:00', end: '11:00' },
	timezone: 'UTC'
};

const monthlyRule = new RRuleTemporal(toRRuleTemporalOptions(monthlyRecurrence));

// Get next 5 occurrences
const next5 = monthlyRule.all((_, i) => i < 5);
console.log(
	'Next 5 monthly occurrences:',
	next5.map((dt) => dt.toString())
);

// Example 4: One-time event
const oneTimeRecurrence: Recurrence = {
	frequency: 'once',
	interval: 1,
	startDate: new Date('2025-02-14T18:00:00.000Z'),
	endCondition: { type: 'never' },
	timeRange: { start: '18:00', end: '20:00' },
	timezone: 'UTC'
};

const oneTimeRule = new RRuleTemporal(toRRuleTemporalOptions(oneTimeRecurrence));
const oneTimeOccurrence = oneTimeRule.all();
console.log(
	'One-time event:',
	oneTimeOccurrence.map((dt) => dt.toString())
);

// Example 5: Converting back from rrule-temporal to UI format
const backToUI = fromRRuleTemporalOptions(rruleOptions);
console.log('Converted back to UI format:', backToUI);

/**
 * Helper function to generate time slots for backward compatibility
 * @deprecated Use generateTimeSlotsMulti from recurrence-utils.ts instead
 */
export function generateTimeSlots(recurrence: Recurrence): Date[] {
	try {
		// Convert old Recurrence to RecurrenceMulti format
		const recurrenceMulti: RecurrenceMulti = {
			frequency: recurrence.frequency,
			interval: recurrence.interval,
			weekdays: recurrence.weekdays,
			startDate: recurrence.startDate.toTemporalInstant(),
			endCondition:
				recurrence.endCondition.type === 'onDate'
					? { type: 'onDate', onDate: recurrence.endCondition.onDate.toTemporalInstant() }
					: recurrence.endCondition,
			timeWindows: [recurrence.timeRange],
			exceptions: recurrence.exceptions?.map((date) => date.toTemporalInstant()),
			timezone: recurrence.timezone
		};

		// Use the new multi-window function
		const timeSlots = generateTimeSlotsMulti(recurrenceMulti);
		return timeSlots.map((slot) => slot.start);
	} catch (error) {
		console.error('Error generating time slots:', error);
		return [];
	}
}
