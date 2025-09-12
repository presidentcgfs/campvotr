# Zod Schema Implementation for Draw Sessions

## Summary

Created comprehensive Zod schemas for Draw Sessions and implemented them for form validation in server actions, ensuring type safety and proper data validation.

## Files Created

### `src/lib/schemas/draw-session-schemas.ts`

Complete Zod schema definitions for:

1. **Entity Schemas**:
   - `drawParticipantSchema` - Participant validation
   - `fieldSchema` - Field information validation
   - `timeSlotSchema` - Time slot with all properties
   - `drawScheduleSchema` - Schedule with recurrence
   - `drawSessionSchema` - Complete session validation

2. **Form Action Schemas**:
   - `assignActionSchema` - Validates assign action data
   - `unassignActionSchema` - Validates unassign action data
   - `pickActionSchema` - Validates pick action data

3. **Type Exports**:
   - All types are inferred from schemas using `z.infer`
   - Ensures types and validation are always in sync

## Implementation in Server Actions

### Updated `+page.server.ts`

1. **Assign Action**:
```typescript
// Parse and validate form data using the imported schema
const parseResult = await parseResponse(assignActionSchema, request);
if ('error' in parseResult) {
  return { error: parseResult.error };
}

const { pattern, fieldId, participantId, isSynthetic, startUtc, endUtc } = parseResult;
```

2. **Unassign Action**:
```typescript
// Parse and validate form data using the imported schema
const parseResult = await parseResponse(unassignActionSchema, request);
if ('error' in parseResult) {
  return { error: parseResult.error };
}

const { pattern, fieldId } = parseResult;
```

3. **Pick Action**:
```typescript
// Parse and validate form data using the imported schema
const parseResult = await parseResponse(pickActionSchema, request);
if ('error' in parseResult) {
  return { error: parseResult.error };
}

const { slotId } = parseResult;
```

## Schema Features

### Validation Rules

1. **String Validation**:
   - Required fields with minimum length
   - Email format for participant emails
   - URL format for avatar URLs
   - Regex patterns for time formats (HH:MM)
   - Weekday validation (SU, MO, TU, etc.)

2. **Type Transformations**:
   - `isSynthetic` transforms string "true" to boolean
   - Optional fields properly handled

3. **Complex Types**:
   - Nested objects (schedules within sessions)
   - Arrays with proper item validation
   - Nullable and optional fields

### Example Schema Definition

```typescript
export const timeSlotSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  fieldId: z.string(),
  fieldName: z.string(),
  pattern: z.string(),
  startUtc: z.string(), // ISO string
  endUtc: z.string(), // ISO string
  startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  endTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  weekday: z.string().regex(/^(SU|MO|TU|WE|TH|FR|SA)$/),
  weekdayName: z.string(),
  status: timeSlotStatusSchema,
  heldByUserId: z.string().nullable(),
  isSynthetic: z.boolean(),
  isPattern: z.boolean()
});
```

## Benefits

1. **Runtime Validation**: All form data is validated at runtime
2. **Type Safety**: Types are inferred from schemas
3. **Error Messages**: Automatic, descriptive error messages
4. **Single Source of Truth**: Schema defines both validation and types
5. **Maintainability**: Changes to validation automatically update types

## Usage Pattern

```typescript
// Import schemas
import { assignActionSchema } from '$lib/schemas/draw-session-schemas';

// In server action
const parseResult = await parseResponse(assignActionSchema, request);
if ('error' in parseResult) {
  return { error: parseResult.error };
}

// Destructure validated data with full type safety
const { pattern, fieldId, participantId, isSynthetic, startUtc, endUtc } = parseResult;

// Use validated data with confidence
if (isSynthetic && startUtc && endUtc) {
  // startUtc and endUtc are guaranteed to be strings if present
  const startDate = new Date(startUtc);
  const endDate = new Date(endUtc);
  // ...
}
```

## Error Handling

The schemas provide automatic error messages:
- "Pattern is required" for missing pattern
- "Field ID is required" for missing fieldId
- "Participant ID is required" for missing participantId
- Invalid format errors for regex-validated fields

## Testing

The implementation ensures:
1. Invalid data is rejected with clear error messages
2. Valid data is properly typed and transformed
3. Optional fields are handled correctly
4. Boolean transformations work ("true" → true)
5. All server actions use consistent validation
