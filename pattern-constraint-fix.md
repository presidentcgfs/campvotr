# Pattern Constraint Fix

## Problem
The database has a check constraint `pattern_rrule_basic_check` that requires patterns to be in the format:
```
DTSTART:YYYYMMDDTHHMMSSZ
RRULE:FREQ=...
```

But we were generating patterns in different formats:
- Single line: `FREQ=DAILY;COUNT=1;DTSTART=...`
- Simple format: `MO 09:00-10:00`

This caused the error:
```
new row for relation "time_slots" violates check constraint "pattern_rrule_basic_check"
```

## Solution

### 1. Fixed TimeSlotService.generatePattern()
Updated to generate patterns matching the constraint:
```typescript
// Format: DTSTART:...\nRRULE:FREQ=WEEKLY;BYDAY=...
return `DTSTART:${dtstart}\nRRULE:FREQ=WEEKLY;BYDAY=${weekday}`;
```

### 2. Fixed TimeSlotService.generatePatternFromRecurrence()
Updated to build proper RRULE patterns with DTSTART on first line and RRULE on second:
```typescript
// Format: DTSTART:...\nRRULE:...
return `DTSTART:${dtstart}\nRRULE:${rrule}`;
```

### 3. Updated Synthetic Slot Generation
- Synthetic slots now use proper RRULE patterns for database storage
- Added `displayPattern` field for simple display format (e.g., "MO 09:00-10:00")
- Use simple pattern for deduplication keys to match between synthetic and DB slots

### 4. Updated Assignment Logic
When assigning a synthetic slot:
- Parse the DTSTART from the RRULE pattern
- Extract date/time components
- Create slot with proper dates
- Use `bulkCreateIfValid()` which generates compliant patterns

## Pattern Formats

### Database Pattern (matches constraint)
```
DTSTART:20250915T090000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
```

### Display Pattern (for UI)
```
MO 09:00-10:00
```

### Deduplication Key
```
${fieldId}:${displayPattern}
```
Example: `field-123:MO 09:00-10:00`

## Benefits
- ✅ Patterns now pass database constraint validation
- ✅ Synthetic slots can be persisted when assigned
- ✅ Consistent pattern format across all operations
- ✅ Clear separation between storage format and display format
