# Pattern Format Fix for Database Constraint

## Problem
The database constraint `pattern_rrule_basic_check` was rejecting our patterns because we were using the wrong format. We were generating:
```
DTSTART:20250901T090000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
```

But the constraint regex expects:
```
DTSTART20250901T090000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
```

## The Constraint
The database check constraint regex is:
```sql
'^DTSTART[^\\n]*\\nRRULE:FREQ=[A-Z]+(;[A-Z]+=[^;=\\n]+)*$'
```

This means:
- `DTSTART` without a colon
- Followed by any characters except newline
- Then a newline
- Then `RRULE:` with a colon
- Followed by the frequency and optional parameters

## Solution

### Fixed all pattern generation methods:

1. **TimeSlotService.generatePattern()**
```typescript
// Before: DTSTART:${dtstart}
// After:  DTSTART${dtstart}
return `DTSTART${dtstart}\nRRULE:FREQ=WEEKLY;BYDAY=${weekday}`;
```

2. **TimeSlotService.generatePatternFromRecurrence()**
```typescript
// Before: DTSTART:${dtstart}
// After:  DTSTART${dtstart}
return `DTSTART${dtstart}\nRRULE:${rrule}`;
```

3. **Synthetic slot generation in +page.server.ts**
```typescript
// Updated to match: DTSTART without colon
const rrulePattern = `DTSTART${dtstart}\nRRULE:FREQ=WEEKLY;BYDAY=${weekday}`;
```

4. **Pattern parsing in assign action**
```typescript
// Updated regex to match DTSTART without colon
const dtStartMatch = pattern.match(/DTSTART(\d{8}T\d{6}Z)/);
```

## Key Takeaway
The pattern format must be:
- `DTSTART` (no colon) followed immediately by the timestamp
- `RRULE:` (with colon) followed by the recurrence rule

This subtle difference (colon vs no colon) was causing the constraint violation.

## Result
✅ Patterns now pass the database constraint
✅ Synthetic slots can be created and persisted
✅ Assignment of synthetic slots works correctly
