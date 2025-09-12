import { describe, it, expect } from 'vitest';
import {
	toRuleStr,
	type RecurrenceMulti,
	type TimeWindow
} from '$lib/components/recurrence/recurrence-utils';

describe('TimeSlot Pattern Generation', () => {
	it('should generate consistent RRule patterns for same recurrence', () => {
		const recurrence: RecurrenceMulti = {
			frequency: 'weekly',
			interval: 1,
			weekdays: ['MO', 'WE', 'FR'],
			startDate: new Date('2024-01-01T00:00:00Z'),
			endCondition: { type: 'afterCount', count: 5 },
			timeWindows: [{ start: '09:00', end: '10:00' }],
			exceptions: [],
			timezone: 'UTC'
		};

		const timeWindow: TimeWindow = { start: '09:00', end: '10:00' };

		// Generate pattern twice - should be identical
		const pattern1 = toRuleStr(recurrence, timeWindow);
		const pattern2 = toRuleStr(recurrence, timeWindow);

		expect(pattern1).toBe(pattern2);
		expect(pattern1).toMatch(/^DTSTART[^\n]*\nRRULE:FREQ=[A-Z]+(;[A-Z]+=[^;=\n]+)*$/);
		expect(pattern1).toContain('FREQ=WEEKLY');
		expect(pattern1).toContain('BYDAY=MO,WE,FR');
	});

	it('should generate different patterns for different recurrences', () => {
		const baseRecurrence: RecurrenceMulti = {
			frequency: 'weekly',
			interval: 1,
			weekdays: ['MO', 'WE', 'FR'],
			startDate: new Date('2024-01-01T00:00:00Z'),
			endCondition: { type: 'afterCount', count: 5 },
			timeWindows: [{ start: '09:00', end: '10:00' }],
			exceptions: [],
			timezone: 'UTC'
		};

		const differentRecurrence: RecurrenceMulti = {
			...baseRecurrence,
			weekdays: ['TU', 'TH'] // Different weekdays
		};

		const timeWindow: TimeWindow = { start: '09:00', end: '10:00' };

		const pattern1 = toRuleStr(baseRecurrence, timeWindow);
		const pattern2 = toRuleStr(differentRecurrence, timeWindow);

		expect(pattern1).not.toBe(pattern2);
		expect(pattern1).toContain('BYDAY=MO,WE,FR');
		expect(pattern2).toContain('BYDAY=TU,TH');
	});

	it('should generate different patterns for different time windows', () => {
		const recurrence: RecurrenceMulti = {
			frequency: 'weekly',
			interval: 1,
			weekdays: ['MO', 'WE', 'FR'],
			startDate: new Date('2024-01-01T00:00:00Z'),
			endCondition: { type: 'afterCount', count: 5 },
			timeWindows: [{ start: '09:00', end: '10:00' }],
			exceptions: [],
			timezone: 'UTC'
		};

		const timeWindow1: TimeWindow = { start: '09:00', end: '10:00' };
		const timeWindow2: TimeWindow = { start: '14:00', end: '15:00' };

		const pattern1 = toRuleStr(recurrence, timeWindow1);
		const pattern2 = toRuleStr(recurrence, timeWindow2);

		expect(pattern1).not.toBe(pattern2);
		// Both should be valid RRule patterns
		expect(pattern1).toMatch(/^DTSTART[^\n]*\nRRULE:FREQ=[A-Z]+(;[A-Z]+=[^;=\n]+)*$/);
		expect(pattern2).toMatch(/^DTSTART[^\n]*\nRRULE:FREQ=[A-Z]+(;[A-Z]+=[^;=\n]+)*$/);
	});

	it('should generate valid patterns for daily frequency', () => {
		const recurrence: RecurrenceMulti = {
			frequency: 'daily',
			interval: 2, // Every 2 days
			startDate: new Date('2024-01-01T00:00:00Z'),
			endCondition: { type: 'afterCount', count: 10 },
			timeWindows: [{ start: '09:00', end: '10:00' }],
			exceptions: [],
			timezone: 'UTC'
		};

		const timeWindow: TimeWindow = { start: '09:00', end: '10:00' };
		const pattern = toRuleStr(recurrence, timeWindow);

		expect(pattern).toMatch(/^DTSTART[^\n]*\nRRULE:FREQ=[A-Z]+(;[A-Z]+=[^;=\n]+)*$/);
		expect(pattern).toContain('FREQ=DAILY');
		expect(pattern).toContain('INTERVAL=2');
	});

	it('should generate valid patterns for monthly frequency', () => {
		const recurrence: RecurrenceMulti = {
			frequency: 'monthly',
			interval: 1,
			startDate: new Date('2024-01-01T00:00:00Z'),
			endCondition: { type: 'onDate', onDate: new Date('2024-12-31T00:00:00Z') },
			timeWindows: [{ start: '09:00', end: '10:00' }],
			exceptions: [],
			timezone: 'UTC'
		};

		const timeWindow: TimeWindow = { start: '09:00', end: '10:00' };
		const pattern = toRuleStr(recurrence, timeWindow);

		expect(pattern).toMatch(/^DTSTART[^\n]*\nRRULE:FREQ=[A-Z]+(;[A-Z]+=[^;=\n]+)*$/);
		expect(pattern).toContain('FREQ=MONTHLY');
	});

	it('should normalize patterns consistently', () => {
		const recurrence: RecurrenceMulti = {
			frequency: 'weekly',
			interval: 1,
			weekdays: ['MO', 'WE', 'FR'],
			startDate: new Date('2024-01-01T00:00:00Z'),
			endCondition: { type: 'afterCount', count: 5 },
			timeWindows: [{ start: '09:00', end: '10:00' }],
			exceptions: [],
			timezone: 'UTC'
		};

		const timeWindow: TimeWindow = { start: '09:00', end: '10:00' };
		const pattern = toRuleStr(recurrence, timeWindow);

		// Pattern should be trimmed and normalized
		expect(pattern).toBe(pattern.trim());
		expect(pattern).not.toContain('  '); // No double spaces
		expect(pattern.length).toBeGreaterThan(0);
	});
});
