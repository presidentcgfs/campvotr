import { z } from 'zod/v4';
const time = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, { message: 'Invalid time format' });
export const validateDrawSession = z
	.object({
		name: z.string().trim().min(1).max(120),
		turnStrategy: z.enum(['random', 'round_robin', 'snake']),
		rounds: z.coerce.number().int().min(1).nullable().optional(),
		pickTimeoutSec: z.coerce.number().int().min(10).max(3600),
		startsAtUtc: z.coerce.date().min(new Date()),
		startDate: z.coerce.date().min(new Date()),
		endDate: z.coerce.date().min(new Date()),

		participants: z
			.array(z.object({ email: z.email(), role: z.string() }))
			.min(1)
			.max(200),
		schedules: z.array(
			z.object({
				fieldIds: z.array(z.string().uuid()).min(1),
				recurrence: z.object({
					frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
					interval: z.coerce.number().int().min(1),
					weekdays: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
					startDate: z.coerce.date(),
					endCondition: z.object({
						type: z.enum(['never', 'onDate', 'afterCount']),
						onDate: z.coerce.date().optional(),
						count: z.coerce.number().int().min(1).optional()
					}),
					timeWindows: z
						.array(
							z.object({
								start: time,
								end: time
							})
						)
						.min(1),
					exceptions: z.array(z.coerce.date()).optional(),
					timezone: z.string().optional()
				})
			})
		)
	})
	.refine((data) => data.endDate > data.startDate, {
		message: 'End date must be after start date',
		path: ['endDate'] // Optional: Specify the field to associate the error message with
	});

export type DrawSession = z.infer<typeof validateDrawSession>;
