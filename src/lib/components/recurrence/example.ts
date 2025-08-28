import { RRuleTemporal } from 'rrule-temporal';
import {
	toRRuleTemporalOptions,
	fromRRuleTemporalOptions,
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
 * Example usage of RecurrencePicker with rrule-temporal library
 */

// Example 1: Weekly recurrence every Tuesday and Thursday at 2:30 PM for 10 occurrences
const weeklyRecurrence: Recurrence = {
	frequency: 'weekly',
	interval: 1,
	weekdays: ['TU', 'TH'],
	startDate: new Date('2025-01-01T14:30:00.000Z'),
	endCondition: { type: 'afterCount', count: 10 },
	timeRange: { start: '14:30', end: '15:30' },
	exceptions: [],
	timezone: 'UTC'
};

// Convert to rrule-temporal options
const rruleOptions = toRRuleTemporalOptions(weeklyRecurrence);
console.log('RRule Options:', rruleOptions);

// Create RRuleTemporal instance
const rule = new RRuleTemporal(rruleOptions);

// Generate all occurrences
const occurrences = rule.all();
console.log(
	'Generated occurrences:',
	occurrences.map((dt) => dt.toString())
);

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
 * Helper function to generate time slots for a field draw session
 */
export function generateTimeSlots(recurrence: Recurrence): Date[] {
	try {
		// Create RRULE string format that rrule-temporal expects
		const dtstart = recurrence.startDate.toISOString().replace(/[-:]/g, '').slice(0, 15);
		const tzid = recurrence.timezone || 'UTC';

		let rruleString = `DTSTART;TZID=${tzid}:${dtstart}\nRRULE:`;

		// Build RRULE parts
		const ruleParts: string[] = [];

		// Frequency
		const freq = recurrence.frequency === 'once' ? 'DAILY' : recurrence.frequency.toUpperCase();
		ruleParts.push(`FREQ=${freq}`);

		// Interval
		if (recurrence.interval > 1) {
			ruleParts.push(`INTERVAL=${recurrence.interval}`);
		}

		// Count or Until
		if (recurrence.endCondition.type === 'afterCount') {
			ruleParts.push(`COUNT=${recurrence.endCondition.count}`);
		} else if (recurrence.endCondition.type === 'onDate') {
			const until =
				recurrence.endCondition.onDate.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
			ruleParts.push(`UNTIL=${until}`);
		}

		// For 'once' frequency, always set count to 1
		if (recurrence.frequency === 'once') {
			ruleParts.push('COUNT=1');
		}

		// Weekdays for weekly frequency
		if (recurrence.frequency === 'weekly' && recurrence.weekdays?.length) {
			ruleParts.push(`BYDAY=${recurrence.weekdays.join(',')}`);
		}

		// Time constraints
		if (recurrence.timeRange.start) {
			const [hour, minute] = recurrence.timeRange.start.split(':').map(Number);
			ruleParts.push(`BYHOUR=${hour}`);
			ruleParts.push(`BYMINUTE=${minute}`);
		}

		rruleString += ruleParts.join(';');

		// Create rule from string
		const rule = new RRuleTemporal({ rruleString });

		// Generate all occurrences and convert to regular Date objects
		const occurrences = rule.all();
		return occurrences.map((zdt) => new Date(zdt.toInstant().epochMilliseconds));
	} catch (error) {
		console.error('Error generating time slots:', error);
		return [];
	}
}
