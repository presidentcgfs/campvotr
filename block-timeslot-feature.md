# Block/Reserve Time Slot Feature

## Summary

Implemented functionality for admins to block or reserve time slots through the UI with a modal for entering a description/reason.

## Components Created

### 1. BlockSlotModal.svelte
- Modal component for blocking time slots
- Requires admin to enter a reason for blocking
- Shows slot information (time, field)
- Warning message about the implications
- Form validation ensures reason is provided

## Components Modified

### 2. FieldSlot.svelte
- Added block/unblock buttons for admin users
- Block button shows for available slots
- Unblock button shows for blocked slots
- Icons: BanOutline for block, LockOpenOutline for unblock
- Buttons only visible to admins

### 3. DrawSchedule.svelte
- Added modal state management
- Handlers for block/unblock actions
- Passes handlers down to FieldSlot components
- Integrates BlockSlotModal component

### 4. +page.svelte (Schedule Page)
- Added handleBlockSlot and handleUnblockSlot functions
- Handles synthetic slot creation before blocking
- Passes handlers to DrawSchedule component

## Server Implementation

### 5. +page.server.ts
- Added `block` and `unblock` server actions
- Handles synthetic slot creation if needed
- Uses Zod schemas for validation

### 6. TimeSlotService
- Added `blockSlotByPattern` method
- Added `unblockSlotByPattern` method
- Creates slot if it doesn't exist when blocking
- Updates slot status and blocked reason

### 7. Zod Schemas
- `blockActionSchema` - validates block action data
- `unblockActionSchema` - validates unblock action data
- Includes pattern, fieldId, reason, and optional synthetic slot data

## User Flow

### Blocking a Slot:
1. Admin clicks "Block" button on an available slot
2. Modal opens showing slot details
3. Admin enters reason for blocking (required)
4. On confirm:
   - If synthetic slot, creates it in DB first
   - Updates slot status to "blocked"
   - Stores the blocking reason
   - Refreshes the page

### Unblocking a Slot:
1. Admin clicks "Unblock" button on a blocked slot
2. Directly unblocks without modal
3. Updates slot status to "available"
4. Clears the blocking reason
5. Refreshes the page

## Database Changes

- Uses existing `blockedReason` field in time_slots table
- Status changes to "blocked" when blocked
- Status changes back to "available" when unblocked

## Features

### Visual Indicators:
- Blocked slots show with appropriate badge color
- Block button is red outline style
- Unblock button is yellow solid style
- Icons provide clear visual cues

### Validation:
- Reason is required when blocking
- Only admins can block/unblock
- Only available slots can be blocked
- Only blocked slots can be unblocked

### Error Handling:
- Shows error messages in modal if blocking fails
- Handles synthetic slot creation errors
- Proper error messages for failed operations

## Technical Details

### Pattern-Based Operations:
- Uses pattern + fieldId + organizationId to identify slots
- Supports both persisted and synthetic slots
- Creates slots on-demand when blocking synthetic ones

### Type Safety:
- Full TypeScript types throughout
- Zod validation for form data
- Proper error types and handling

## Usage Example

```typescript
// Block a slot
await handleBlockSlot(timeSlot, "Field maintenance scheduled");

// Unblock a slot
await handleUnblockSlot(timeSlot);
```

## Benefits

1. **Administrative Control**: Admins can manage slot availability
2. **Transparency**: Reasons for blocking are recorded
3. **Flexibility**: Can block/unblock at any time
4. **User Experience**: Clear visual indicators and modal flow
5. **Data Integrity**: Proper validation and error handling

## Testing Checklist

- [ ] Admin can see block button on available slots
- [ ] Block modal opens with slot information
- [ ] Reason is required to block a slot
- [ ] Blocked slots show correct status
- [ ] Admin can see unblock button on blocked slots
- [ ] Unblocking works without modal
- [ ] Non-admins cannot see block/unblock buttons
- [ ] Synthetic slots can be blocked
- [ ] Error messages display properly
- [ ] Page refreshes after successful action
