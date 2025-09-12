# Synthetic Time Slots Implementation

## Overview
We've successfully implemented synthetic/simulated time slots that are generated from draw session schedules and only persisted to the database when they are assigned or their status changes (lazy persistence).

## Key Changes

### 1. +page.server.ts Load Function
- **Generates synthetic slots** from session schedules using the recurrence patterns
- Each schedule's recurrence pattern is processed with `generateTimeSlotsMulti()`
- Creates synthetic slots for each field in the schedule
- **Merges synthetic and DB slots** where DB slots take precedence
- Uses composite key `${fieldId}:${pattern}` for deduplication
- Marks synthetic slots with `isSynthetic: true` flag

### 2. +page.server.ts Assign Action
- Detects when assigning a synthetic slot via `isSynthetic` flag
- **Creates the slot in DB first** using `bulkCreateIfValid()` if synthetic
- Parses the pattern to extract weekday and times
- Generates proper UTC dates for the slot
- Then assigns the slot using pattern-based assignment
- Handles both synthetic and existing DB slots seamlessly

### 3. Client Components
- **+page.svelte**: Passes `isSynthetic` flag in form data when assigning
- **FieldSlot.svelte**: Shows "Synthetic" badge for non-persisted slots
- **DrawSchedule.svelte**: Updated TimeSlot interface to include `isSynthetic`

## How It Works

1. **Generation Phase**:
   - When loading the schedule page, synthetic slots are generated from session schedules
   - These slots exist only in memory with `isSynthetic: true` flag
   - Pattern format: "MO 09:00-10:00" (weekday + time range)

2. **Display Phase**:
   - Both synthetic and DB slots are shown in the UI
   - Synthetic slots have a yellow "Synthetic" badge
   - DB slots override synthetic ones with the same (fieldId, pattern) key

3. **Assignment Phase**:
   - When assigning a participant to a synthetic slot:
     - The slot is first created in the database
     - Then the assignment is performed
   - This ensures lazy persistence - only save when needed

4. **Deduplication**:
   - Uses composite key `${fieldId}:${pattern}` to prevent duplicates
   - DB slots always take precedence over synthetic ones
   - Ensures unique display of each slot

## Benefits

✅ **Efficient Storage**: Only persists slots that are actually used
✅ **Full Schedule View**: Users see all possible slots from schedules
✅ **Lazy Persistence**: Database writes only when necessary
✅ **Pattern-Based Identity**: Consistent deduplication across synthetic and DB slots
✅ **Visual Distinction**: Clear indication of synthetic vs persisted slots

## Technical Details

### Synthetic Slot Structure
```javascript
{
  id: `synthetic-${key}`, // Synthetic ID
  organizationId: orgId,
  fieldId,
  fieldName,
  pattern, // e.g., "MO 09:00-10:00"
  startUtc: slot.start.toISOString(),
  endUtc: slot.end.toISOString(),
  startTime, // e.g., "09:00"
  endTime,   // e.g., "10:00"
  weekday,   // e.g., "MO"
  weekdayName, // e.g., "Monday"
  status: 'available',
  heldByUserId: null,
  isSynthetic: true, // Key flag
  isPattern: true
}
```

### Pattern Format
- Format: `"${WEEKDAY} ${START_TIME}-${END_TIME}"`
- Example: `"MO 09:00-10:00"`
- Weekdays: SU, MO, TU, WE, TH, FR, SA
- Times: 24-hour format (HH:mm)

### Database Creation
When a synthetic slot is assigned:
1. Parse pattern to extract components
2. Calculate proper UTC dates
3. Call `bulkCreateIfValid()` to create slot
4. Handle conflicts gracefully (slot may already exist)
5. Proceed with assignment using pattern-based method

## Testing Checklist

- [ ] Navigate to a draw session schedule page
- [ ] Verify synthetic slots are displayed (with yellow badge)
- [ ] Verify DB slots override synthetic ones (no yellow badge)
- [ ] Assign a participant to a synthetic slot
- [ ] Verify slot is persisted and assignment succeeds
- [ ] Refresh page and verify slot is now from DB
- [ ] Unassign participant and verify it works
- [ ] Check for no duplicate slots (same field + pattern)
