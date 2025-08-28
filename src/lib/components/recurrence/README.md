# RecurrencePicker Component

A comprehensive Svelte component for configuring recurring events with full integration to the `rrule-temporal` library.

## Features

- 🎯 **User-friendly interface** for configuring complex recurrence patterns
- 📅 **Multiple frequencies**: Once, Daily, Weekly, Monthly, Yearly
- ⏰ **Time range selection** with validation
- 📊 **End conditions**: Never, After count, On specific date
- 🚫 **Exception dates** for skipping specific occurrences
- ✅ **Real-time validation** with helpful error messages
- 🔄 **rrule-temporal integration** for generating actual time slots
- ♿ **Accessibility compliant** with proper ARIA labels
- 🎨 **Flowbite-Svelte** components with Tailwind CSS styling

## Installation

```bash
pnpm add rrule-temporal
```

## Basic Usage

```svelte
<script lang="ts">
  import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
  import { generateTimeSlots } from '$lib/components/recurrence/example.js';
  import type { Recurrence } from '$lib/components/recurrence/recurrence-utils.js';

  let recurrence: Recurrence = {
    frequency: 'weekly',
    interval: 1,
    weekdays: ['MO', 'WE', 'FR'],
    startDate: new Date(),
    endCondition: { type: 'afterCount', count: 10 },
    timeRange: { start: '09:00', end: '10:00' },
    exceptions: [],
    timezone: 'UTC'
  };

  // Generate actual time slots
  $: timeSlots = generateTimeSlots(recurrence);
</script>

<RecurrencePicker bind:value={recurrence} />
```

## Advanced Usage with rrule-temporal

```svelte
<script lang="ts">
  import { RRuleTemporal } from 'rrule-temporal';
  import { toRRuleTemporalOptions } from '$lib/components/recurrence/recurrence-utils.js';

  let recurrence = { /* ... */ };

  function generateOccurrences() {
    const rruleOptions = toRRuleTemporalOptions(recurrence);
    const rule = new RRuleTemporal(rruleOptions);
    
    // Get all occurrences
    const occurrences = rule.all();
    
    // Get next 5 occurrences
    const next5 = rule.all((_, i) => i < 5);
    
    // Get occurrences in date range
    const inRange = rule.between(
      new Date('2025-01-01'),
      new Date('2025-12-31')
    );
    
    return occurrences.map(zdt => new Date(zdt.toInstant().epochMilliseconds));
  }
</script>
```

## Data Structure

### Recurrence Type

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

### `toRRuleTemporalOptions(recurrence: Recurrence)`
Converts UI-friendly recurrence configuration to rrule-temporal compatible options.

### `fromRRuleTemporalOptions(options: RRuleTemporalOptions)`
Converts rrule-temporal options back to UI-friendly format.

### `generateTimeSlots(recurrence: Recurrence): Date[]`
Generates an array of Date objects representing all occurrences.

### `getRecurrenceDescription(recurrence: Recurrence): string`
Returns a human-readable description of the recurrence pattern.

### Validation Functions
- `validateTimeRange(start: string, end: string): string | null`
- `validateInterval(interval: number): string | null`
- `validateCount(count: number): string | null`
- `validateWeekdays(weekdays: string[], frequency: string): string | null`

## Examples

### Daily Standup (Every weekday for 2 weeks)
```javascript
{
  frequency: 'daily',
  interval: 1,
  startDate: new Date(),
  endCondition: { type: 'afterCount', count: 10 },
  timeRange: { start: '09:00', end: '09:30' },
  exceptions: [],
  timezone: 'UTC'
}
```

### Weekly Team Meeting (Every Tuesday)
```javascript
{
  frequency: 'weekly',
  interval: 1,
  weekdays: ['TU'],
  startDate: new Date(),
  endCondition: { type: 'never' },
  timeRange: { start: '14:00', end: '15:00' },
  exceptions: [],
  timezone: 'UTC'
}
```

### Monthly Review (15th of each month for 1 year)
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

  let recurrence = { /* ... */ };
  
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

## Browser Support

- Modern browsers with ES2020+ support
- Requires Temporal API polyfill (provided by rrule-temporal)

## Dependencies

- `rrule-temporal`: RFC 5545 compliant recurrence rule processing
- `flowbite-svelte`: UI components
- `flowbite-svelte-icons`: Icons
- Tailwind CSS: Styling
