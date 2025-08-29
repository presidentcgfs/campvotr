# RecurrencePicker Component

A comprehensive Svelte component for configuring recurring events with full integration to the `rrule-temporal` library. Now supports **multiple time windows** per recurrence pattern.

## Features

- 🎯 **User-friendly interface** for configuring complex recurrence patterns
- 📅 **Multiple frequencies**: Once, Daily, Weekly, Monthly, Yearly
- ⏰ **Multiple time windows** per schedule with overlap detection
- 📊 **End conditions**: Never, After count, On specific date
- 🚫 **Exception dates** for skipping specific occurrences
- ✅ **Real-time validation** with helpful error messages
- 🔄 **rrule-temporal integration** for generating actual time slots
- ♿ **Accessibility compliant** with proper ARIA labels
- 🎨 **Flowbite-Svelte** components with Tailwind CSS styling
- 🔄 **Backward compatibility** with single time range format

## Installation

```bash
pnpm add rrule-temporal
```

## Basic Usage

```svelte
<script lang="ts">
	import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
	import { generateTimeSlotsMulti } from '$lib/components/recurrence/recurrence-utils.js';
	import type { RecurrenceMulti } from '$lib/components/recurrence/recurrence-utils.js';

	let recurrence: RecurrenceMulti = {
		frequency: 'weekly',
		interval: 1,
		weekdays: ['MO', 'WE', 'FR'],
		startDate: new Date().toTemporalInstant(),
		endCondition: { type: 'afterCount', count: 10 },
		timeWindows: [
			{ start: '09:00', end: '10:00' },
			{ start: '14:00', end: '15:00' }
		],
		exceptions: [],
		timezone: 'UTC'
	};

	// Generate actual time slots with start/end times
	$: timeSlots = generateTimeSlotsMulti(recurrence);
</script>

<RecurrencePicker bind:value={recurrence} />
```

## Advanced Usage with rrule-temporal

```svelte
<script lang="ts">
	import { RRuleTemporal } from 'rrule-temporal';
	import { toRRuleTemporalOptions } from '$lib/components/recurrence/recurrence-utils.js';

	let recurrence = {
		/* ... */
	};

	function generateOccurrences() {
		const rruleOptions = toRRuleTemporalOptions(recurrence);
		const rule = new RRuleTemporal(rruleOptions);

		// Get all occurrences
		const occurrences = rule.all();

		// Get next 5 occurrences
		const next5 = rule.all((_, i) => i < 5);

		// Get occurrences in date range
		const inRange = rule.between(new Date('2025-01-01'), new Date('2025-12-31'));

		return occurrences.map((zdt) => new Date(zdt.toInstant().epochMilliseconds));
	}
</script>
```

## Data Structure

### RecurrenceMulti Type (Current)

```typescript
type RecurrenceMulti = {
	frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
	interval: number; // >= 1
	weekdays?: Weekday[]; // only for weekly
	startDate: Temporal.Instant; // UTC date-only (00:00 UTC)
	endCondition: EndCondition;
	timeWindows: TimeWindow[]; // one or more daily time windows
	exceptions?: Temporal.Instant[]; // optional exclusion dates (UTC date-only)
	timezone?: string; // default 'UTC'
};

type TimeWindow = {
	start: string; // 'HH:mm' 24h format, required
	end: string; // 'HH:mm' 24h format, required, end > start (same day only)
};

type EndCondition =
	| { type: 'never' }
	| { type: 'onDate'; onDate: Temporal.Instant }
	| { type: 'afterCount'; count: number };
```

### Legacy Recurrence Type (Deprecated)

```typescript
type Recurrence = {
	frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
	interval: number; // >= 1
	weekdays?: Array<'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'>; // for weekly
	startDate: Date; // UTC date-only
	endCondition:
		| { type: 'never' }
		| { type: 'onDate'; onDate: Date } // UTC date-only
		| { type: 'afterCount'; count: number }; // >= 1
	timeRange: { start: string; end: string }; // 'HH:mm' 24h format
	exceptions?: Date[]; // UTC dates to exclude (optional)
	timezone?: 'UTC'; // fixed for now; reserved for future
};
```

## Utility Functions

### New Multi-Window Functions

#### `toRRules(recurrence: RecurrenceMulti): RRuleResult[]`

Converts RecurrenceMulti to multiple rrule-temporal compatible rules (one per time window).

```typescript
type RRuleResult = {
	rruleString: string; // "DTSTART;TZID=...:YYYYMMDDTHHmmss\nRRULE:..."
	durationMinutes: number; // derived from window end-start
	options?: RRuleTemporalOptions; // optional: the normalized options used
};
```

#### `fromRRules(rules: RRuleResult[]): RecurrenceMulti`

Converts multiple rrule results back to RecurrenceMulti format.

#### `generateTimeSlotsMulti(recurrence: RecurrenceMulti): TimeSlot[]`

Generates time slots with start/end times for all time windows.

```typescript
type TimeSlot = {
	start: Date;
	end: Date;
	windowIndex: number; // Which time window this slot came from
};
```

#### `getRecurrenceMultiDescription(recurrence: RecurrenceMulti): string`

Returns a human-readable description including multiple time windows.

### Legacy Functions (Deprecated)

#### `toRRuleTemporalOptions(recurrence: Recurrence)`

Converts single-window recurrence to rrule-temporal options.

#### `fromRRuleTemporalOptions(options: RRuleTemporalOptions)`

Converts rrule-temporal options back to single-window format.

#### `generateTimeSlots(recurrence: Recurrence): Date[]`

Generates array of Date objects for single-window recurrence.

#### `getRecurrenceDescription(recurrence: Recurrence): string`

Returns description for single-window recurrence.

### Validation Functions

- `validateTimeRange(start: string, end: string): string | null`
- `validateInterval(interval: number): string | null`
- `validateCount(count: number): string | null`
- `validateWeekdays(weekdays: string[], frequency: string): string | null`

## Examples

### Multiple Time Windows (Morning and Afternoon Sessions)

```javascript
{
  frequency: 'weekly',
  interval: 1,
  weekdays: ['MO', 'WE', 'FR'],
  startDate: new Date().toTemporalInstant(),
  endCondition: { type: 'afterCount', count: 10 },
  timeWindows: [
    { start: '09:00', end: '10:00' },  // Morning session
    { start: '14:00', end: '15:00' }   // Afternoon session
  ],
  exceptions: [],
  timezone: 'UTC'
}
```

### Daily Standup with Break (Single Window)

```javascript
{
  frequency: 'daily',
  interval: 1,
  startDate: new Date().toTemporalInstant(),
  endCondition: { type: 'afterCount', count: 10 },
  timeWindows: [
    { start: '09:00', end: '09:30' }
  ],
  exceptions: [],
  timezone: 'UTC'
}
```

### Complex Schedule (Multiple Windows, Different Durations)

```javascript
{
  frequency: 'weekly',
  interval: 1,
  weekdays: ['TU', 'TH'],
  startDate: new Date().toTemporalInstant(),
  endCondition: { type: 'never' },
  timeWindows: [
    { start: '08:00', end: '09:00' },  // Early session
    { start: '12:00', end: '13:30' },  // Lunch session
    { start: '17:00', end: '18:00' }   // Evening session
  ],
  exceptions: [],
  timezone: 'UTC'
}
```

### Legacy Single Time Range (Deprecated)

```javascript
{
  frequency: 'monthly',
  interval: 1,
  startDate: new Date(2025, 0, 15), // January 15, 2025
  endCondition: { type: 'onDate', onDate: new Date(2025, 11, 31) },
  timeRange: { start: '10:00', end: '12:00' },
  exceptions: [],
  timezone: 'UTC'
}
```

## Demo

Visit `/recurrence-picker-demo` to see an interactive demonstration of all features.

## File Structure

```
src/lib/components/recurrence/
├── RecurrencePicker.svelte          # Main UI component
├── recurrence-utils.ts              # Core utilities & types
├── example.ts                       # Usage examples
└── README.md                        # This documentation
```

## Integration with Draw Sessions

The RecurrencePicker is designed to work seamlessly with your Draw Sessions feature:

```svelte
<script lang="ts">
	import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
	import { generateTimeSlots } from '$lib/components/recurrence/example.js';

	let recurrence = {
		/* ... */
	};

	// Generate time slots for field draw
	$: timeSlots = generateTimeSlots(recurrence);

	async function createDrawSession() {
		const response = await fetch('/api/draw-sessions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Field Draw Session',
				timeSlots: timeSlots,
				recurrence: recurrence
			})
		});
	}
</script>

<RecurrencePicker bind:value={recurrence} />
<button on:click={createDrawSession}>Create Draw Session</button>
```

## Migration Guide

### From Single Time Range to Multiple Time Windows

**Before (Deprecated):**

```typescript
let recurrence: Recurrence = {
	frequency: 'weekly',
	interval: 1,
	weekdays: ['MO', 'WE'],
	startDate: new Date(),
	endCondition: { type: 'afterCount', count: 5 },
	timeRange: { start: '09:00', end: '10:00' },
	exceptions: [],
	timezone: 'UTC'
};
```

**After (Current):**

```typescript
let recurrence: RecurrenceMulti = {
	frequency: 'weekly',
	interval: 1,
	weekdays: ['MO', 'WE'],
	startDate: new Date().toTemporalInstant(),
	endCondition: { type: 'afterCount', count: 5 },
	timeWindows: [{ start: '09:00', end: '10:00' }],
	exceptions: [],
	timezone: 'UTC'
};
```

### Key Changes

1. **Type**: `Recurrence` → `RecurrenceMulti`
2. **Dates**: `Date` → `Temporal.Instant` (use `.toTemporalInstant()`)
3. **Time Range**: `timeRange` → `timeWindows` (array)
4. **Functions**:
   - `generateTimeSlots()` → `generateTimeSlotsMulti()`
   - `getRecurrenceDescription()` → `getRecurrenceMultiDescription()`
   - `toRRuleTemporalOptions()` → `toRRules()`

### Backward Compatibility

The component automatically normalizes old `timeRange` format to `timeWindows` internally, so existing code will continue to work, but you should migrate to the new format for full functionality.

## Browser Support

- Modern browsers with ES2020+ support
- Requires Temporal API polyfill (provided by rrule-temporal)

## Dependencies

- `rrule-temporal`: RFC 5545 compliant recurrence rule processing
- `flowbite-svelte`: UI components
- `flowbite-svelte-icons`: Icons
- Tailwind CSS: Styling
