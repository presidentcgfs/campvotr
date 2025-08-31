import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { drawSessionAdminServiceKey } from '$lib/services/draw-session-admin-service';
import { toRRules } from '$lib/components/recurrence/recurrence-utils';
import { drawSessionSchema } from '$lib/schemas/draw-session-schema';
import { parseResponse } from '$lib/utils/parse';

// Validation schemas
const timeWindowSchema = z.object({
	start: z.string().regex(/^\d{2}:\d{2}$/),
	end: z.string().regex(/^\d{2}:\d{2}$/)
});

const endConditionSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('never') }),
	z.object({ type: z.literal('afterCount'), count: z.number().int().min(1) }),
	z.object({ type: z.literal('onDate'), onDate: z.string() }) // Temporal.Instant as string
]);

const recurrenceMultiSchema = z.object({
	frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'yearly']),
	interval: z.number().int().min(1),
	weekdays: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
	startDate: z.string(), // Temporal.Instant as string
	endCondition: endConditionSchema,
	timeWindows: z.array(timeWindowSchema).min(1),
	exceptions: z.array(z.string()).optional(),
	timezone: z.string().optional()
});

const ruleSchema = z.object({
	rruleString: z.string(),
	durationMinutes: z.number().int().min(1)
});

const scheduleSchema = z.object({
	fieldIds: z.array(z.string().uuid()).min(1),
	recurrence: recurrenceMultiSchema,
	rules: z.array(ruleSchema).min(1)
});

const createDrawSessionSchema = z.object({
	name: z.string().trim().min(1).max(120),
	turnStrategy: z.enum(['random', 'round_robin', 'snake']),
	startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	participants: z
		.array(
			z
				.string()
				.email()
				.or(z.string().regex(/^[^:]+:[^:]+$/))
		)
		.min(1)
		.max(200),
	schedules: z.array(scheduleSchema).min(1)
});

// Helper to resolve organization from request
async function resolveOrganization(event: any, orgService: any) {
	// Check X-ORG-SLUG header first
	const orgSlug = event.request.headers.get('X-ORG-SLUG');
	if (orgSlug) {
		return await orgService.requireOrgMembershipForSlug(event, orgSlug);
	}

	// Check ?org query parameter
	const url = new URL(event.request.url);
	const orgParam = url.searchParams.get('org');
	if (orgParam) {
		// Could be slug or ID
		if (orgParam.match(/^[0-9a-f-]{36}$/i)) {
			return await orgService.requireOrgMembershipForId(event, orgParam);
		} else {
			return await orgService.requireOrgMembershipForSlug(event, orgParam);
		}
	}

	// Fall back to organization context from hooks (domain/subdomain/cookie)
	const orgContext = event.locals.organizationContext;
	if (orgContext?.organization?.id) {
		return await orgService.requireOrgMembershipForId(event, orgContext.organization.id);
	}

	throw new Response('Organization not found', { status: 404 });
}

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const orgService = event.locals.resolve(organizationServiceKey);
		const drawSessionService = event.locals.resolve(drawSessionAdminServiceKey);

		// Resolve organization context
		const orgContext = await resolveOrganization(event, orgService);
		const orgId = orgContext.organization.id;

		// Parse and validate request body
		const data = await parseResponse(drawSessionSchema, event.request);

		// Convert and validate recurrence data
		const processedSchedules = data.schedules.map((schedule) => {
			const recurrence = schedule.recurrence;

			// Verify client rules match server-generated rules
			const serverRules = toRRules({
				...recurrence,
				startDate: new Date(recurrence.startDate).toTemporalInstant(),
				endCondition:
					recurrence.endCondition.type === 'onDate'
						? {
								...recurrence.endCondition,
								onDate: new Date(recurrence.endCondition.onDate).toTemporalInstant()
							}
						: recurrence.endCondition,
				exceptions: recurrence.exceptions?.map((ex: string) => new Date(ex).toTemporalInstant())
			});
			if (schedule.rules.length !== serverRules.length) {
				throw new Error('Client rules do not match server-generated rules');
			}

			// Verify each rule matches
			for (let i = 0; i < schedule.rules.length; i++) {
				const clientRule = schedule.rules[i];
				const serverRule = serverRules[i];

				if (
					clientRule.rruleString !== serverRule.rruleString ||
					clientRule.durationMinutes !== serverRule.durationMinutes
				) {
					throw new Error(`Rule ${i} does not match server-generated rule`);
				}
			}

			return {
				fieldIds: schedule.fieldIds,
				recurrence: {
					...recurrence,
					startDate: new Date(recurrence.startDate).toTemporalInstant(),
					endCondition:
						recurrence.endCondition.type === 'onDate'
							? {
									...recurrence.endCondition,
									onDate: new Date(recurrence.endCondition.onDate).toTemporalInstant()
								}
							: recurrence.endCondition,
					exceptions: recurrence.exceptions?.map((ex: string) => new Date(ex).toTemporalInstant())
				},
				rules: schedule.rules
			};
		});

		// Create draw session
		const result = await drawSessionService.createDrawSession(
			{
				name: data.name,
				turnStrategy: data.turnStrategy,
				startDate: data.startDate.toDateString(),
				endDate: data.endDate.toDateString(),
				participants: data.participants,
				schedules: processedSchedules
			},
			orgId,
			user.id
		);

		return json(result, { status: 201 });
	});

// Return 405 for non-POST methods
export const GET: RequestHandler = async () => {
	return new Response('Method Not Allowed', {
		status: 405,
		headers: { Allow: 'POST' }
	});
};

export const PUT: RequestHandler = async () => {
	return new Response('Method Not Allowed', {
		status: 405,
		headers: { Allow: 'POST' }
	});
};

export const PATCH: RequestHandler = async () => {
	return new Response('Method Not Allowed', {
		status: 405,
		headers: { Allow: 'POST' }
	});
};

export const DELETE: RequestHandler = async () => {
	return new Response('Method Not Allowed', {
		status: 405,
		headers: { Allow: 'POST' }
	});
};
