# Time Slot Persistence Update

## Summary

Modified the DrawSchedule component and related files to pass the complete timeSlot object through to the server, enabling proper persistence of synthetic slots with accurate start and end times.

## Changes Made

### 1. Component Updates

#### DrawSchedule.svelte
- Updated `onAssignParticipant` prop type to include optional `timeSlot` parameter:
  ```typescript
  onAssignParticipant: (
    slotId: string,
    participantId: string | null,
    pattern?: string,
    fieldId?: string,
    timeSlot?: TimeSlot
  ) => void;
  ```

#### FieldSlot.svelte
- Updated `onAssignParticipant` prop type to match DrawSchedule
- Modified `handleParticipantSelect` to pass the complete timeSlot:
  ```typescript
  onAssignParticipant(timeSlot.id, participantId, timeSlot.pattern, timeSlot.fieldId, timeSlot);
  ```

### 2. Client-Side Handler (+page.svelte)

Updated `handleAssignParticipant` to:
- Accept the optional `timeSlot` parameter
- Extract `startUtc` and `endUtc` from synthetic slots
- Pass these times to the server via FormData:
  ```typescript
  if (slot.isSynthetic) {
    formData.append('isSynthetic', 'true');
    if (slot.startUtc) {
      formData.append('startUtc', slot.startUtc);
    }
    if (slot.endUtc) {
      formData.append('endUtc', slot.endUtc);
    }
  }
  ```

### 3. Server-Side Action (+page.server.ts)

Updated the `assign` action to:
- Extract `startUtc` and `endUtc` from FormData
- Create synthetic slots with the correct times before assignment:
  ```typescript
  if (isSynthetic && startUtcStr && endUtcStr) {
    const startUtc = new Date(startUtcStr);
    const endUtc = new Date(endUtcStr);
    
    const createResult = await timeSlotService.bulkCreateIfValid(orgId, [
      { fieldId, startUtc, endUtc }
    ]);
  }
  ```

### 4. TimeSlotService Fix

Fixed the broken `assignSlotByPattern` method signature:
- Changed from accepting a TimeSlot object to proper parameters
- Now uses UPDATE instead of INSERT with conflict handling
- Proper error handling when slot not found

## How It Works

1. **Synthetic Slot Generation**: Creates slots with proper start/end times from schedules
2. **User Selection**: When user assigns a participant to a synthetic slot
3. **Data Flow**: 
   - Complete timeSlot object passed from FieldSlot → DrawSchedule → +page.svelte
   - Start/end times extracted and sent to server
4. **Persistence**: Server creates the slot with exact times before assignment
5. **Assignment**: Slot is then assigned to the participant

## Benefits

- ✅ **Accurate Times**: Synthetic slots are persisted with their exact start/end times
- ✅ **No Data Loss**: All slot information preserved through the assignment flow
- ✅ **Backward Compatible**: Still works with existing non-synthetic slots
- ✅ **Clean Architecture**: Data flows properly through component hierarchy

## Testing

To test:
1. Create a draw session with schedules
2. View the schedule page - synthetic slots should appear
3. Assign a participant to a synthetic slot
4. Verify the slot is created in the database with correct times
5. Verify the assignment is reflected in the UI
