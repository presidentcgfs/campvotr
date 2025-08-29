import { z } from 'zod/v4';

// Time window schema for recurrence
const timeWindowSchema = z.object({
	start: z.iso.time(),
	end: z.iso.time()
});

// End condition schema with discriminated union
const endConditionSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('never')
	}),
	z.object({
		type: z.literal('afterCount'),
		count: z.number().int().min(1, 'Count must be at least 1')
	}),
	z.object({
		type: z.literal('onDate'),
		onDate: z.coerce.date()
	})
]);

// Weekday enum
const weekdaySchema = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);

// Recurrence schema
const recurrenceSchema = z.object({
	frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
	interval: z.number().int().min(1, 'Interval must be at least 1'),
	weekdays: z.array(weekdaySchema).optional(),
	startDate: z.coerce.date(),
	endCondition: endConditionSchema,
	timeWindows: z.array(timeWindowSchema).min(1, 'At least one time window is required'),
	exceptions: z.array(z.string()).optional(),
	timezone: z.string().optional().default('UTC')
});

// RRule options schema (for the options field in rules)
const rruleOptionsSchema = z.object({
	dtstart: z.string(),
	freq: z.string(),
	interval: z.number().optional(),
	tzid: z.string().optional(),
	byDay: z.array(weekdaySchema).optional(),
	byHour: z.array(z.number().int().min(0).max(23)).optional(),
	byMinute: z.array(z.number().int().min(0).max(59)).optional(),
	until: z.string().optional(),
	count: z.number().int().min(1).optional()
});

// Rule schema with optional options field
const ruleSchema = z.object({
	rruleString: z.string().min(1, 'RRULE string is required'),
	durationMinutes: z.number().int().min(1, 'Duration must be at least 1 minute'),
	options: rruleOptionsSchema.optional()
});

// Schedule schema
const scheduleSchema = z.object({
	fieldIds: z
		.array(z.string().uuid({ message: 'Invalid field ID format' }))
		.min(1, 'At least one field ID is required'),
	recurrence: recurrenceSchema,
	rules: z.array(ruleSchema).min(1, 'At least one rule is required')
});

// Main draw session schema
export const drawSessionSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(1, 'Name is required')
			.max(120, 'Name must be 120 characters or less'),
		turnStrategy: z.union([z.literal('random'), z.literal('round_robin'), z.literal('snake')]),
		startDate: z.coerce.date({ message: 'Invalid start date format' }),
		endDate: z.coerce.date({ message: 'Invalid end date format' }),
		participants: z
			.array(
				z
					.email('Invalid email format')
					.or(z.string().regex(/^[^:]+:[^:]+$/, 'Participant must be email or email:role format'))
			)
			.min(1, 'At least one participant is required')
			.max(200, 'Maximum 200 participants allowed'),
		schedules: z.array(scheduleSchema).min(1, 'At least one schedule is required')
	})
	.refine((data) => data.endDate >= data.startDate, {
		message: 'End date must be greater than or equal to start date',
		path: ['endDate']
	});

// Type inference
export type DrawSessionInput = z.infer<typeof drawSessionSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type TimeWindow = z.infer<typeof timeWindowSchema>;
export type EndCondition = z.infer<typeof endConditionSchema>;

// Validation function with detailed error handling
export function validateDrawSession(data: unknown) {
	try {
		return {
			success: true as const,
			data: drawSessionSchema.parse(data)
		};
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false as const,
				error: {
					message: 'Validation failed',
					issues: error.issues.map((issue) => ({
						path: issue.path.join('.'),
						message: issue.message,
						code: issue.code
					}))
				}
			};
		}
		return {
			success: false as const,
			error: {
				message: 'Unknown validation error',
				issues: []
			}
		};
	}
}

// Helper function to validate just the recurrence part
export const recurrenceOnlySchema = recurrenceSchema;

// Helper function to validate just the rules part
export const rulesOnlySchema = z.array(ruleSchema);

// Example usage:
/*
const result = validateDrawSession(yourData);
if (result.success) {
  console.log('Valid data:', result.data);
} else {
  console.error('Validation errors:', result.error.issues);
}
*/
