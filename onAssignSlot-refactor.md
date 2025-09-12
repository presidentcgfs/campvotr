# onAssignParticipant to onAssignSlot Refactor

## Summary

Refactored the slot assignment callback from `onAssignParticipant` to `onAssignSlot` with a simplified signature that passes the complete TimeSlot object.

## Changes Made

### 1. Interface Changes

#### Before:
```typescript
onAssignParticipant: (
  slotId: string,
  participantId: string | null,
  pattern?: string,
  fieldId?: string,
  timeSlot?: TimeSlot
) => void;
```

#### After:
```typescript
onAssignSlot: (slot: TimeSlot, participantId: string | null) => void;
```

### 2. Component Updates

#### DrawSchedule.svelte
- Updated Props interface to use `onAssignSlot`
- Changed prop destructuring from `onAssignParticipant` to `onAssignSlot`
- Updated prop passing to FieldSlot component

#### FieldSlot.svelte
- Updated Props interface to use `onAssignSlot`
- Changed prop destructuring from `onAssignParticipant` to `onAssignSlot`
- Simplified `handleParticipantSelect` function:
  ```typescript
  // Before
  onAssignParticipant(timeSlot.id, participantId, timeSlot.pattern, timeSlot.fieldId, timeSlot);
  
  // After
  onAssignSlot(timeSlot, participantId);
  ```

#### +page.svelte (Schedule Page)
- Renamed `handleAssignParticipant` to `handleAssignSlot`
- Simplified function signature to accept TimeSlot directly
- Removed need to find slot by ID - slot is passed directly
- Updated all references to use slot properties directly
- Updated DrawSchedule component prop from `onAssignParticipant` to `onAssignSlot`

### 3. Benefits

1. **Simpler API**: Reduced from 5 parameters to 2
2. **Type Safety**: Direct TimeSlot object ensures all properties are available
3. **Less Error-Prone**: No need to pass individual properties that might be undefined
4. **Cleaner Code**: Removed redundant slot lookup logic
5. **Better Encapsulation**: The complete slot object is passed, containing all necessary data

### 4. Data Flow

```
User Action (Select Participant)
    ↓
FieldSlot.handleParticipantSelect(participantId)
    ↓
onAssignSlot(timeSlot, participantId)
    ↓
DrawSchedule (passes through)
    ↓
+page.svelte.handleAssignSlot(slot, participantId)
    ↓
Server Action (with all slot data)
```

### 5. Migration Pattern

This refactor demonstrates a common pattern for simplifying callback interfaces:
- Instead of passing multiple optional parameters
- Pass a single object containing all the data
- Let the consumer extract what they need
- Reduces coupling and improves maintainability

## Testing Checklist

- [ ] Assigning participants to slots works
- [ ] Unassigning participants works
- [ ] Synthetic slots can be assigned
- [ ] Pattern and fieldId are properly passed
- [ ] Start/end times are preserved for synthetic slots
- [ ] No TypeScript errors
- [ ] UI updates correctly after assignment
