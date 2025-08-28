import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { recurrenceRuleServiceKey } from '$lib/services/recurrence-rule-service';

const createSchema = z.object({
  fieldId: z.string().uuid(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  interval: z.number().int().min(1).optional(),
  byDay: z.string().optional().nullable(),
  windowStartUtc: z.string().datetime(),
  windowEndUtc: z.string().datetime(),
  blackoutDates: z.string().optional().nullable()
});

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgMembershipForId(event, orgId);

    const svc = event.locals.resolve(recurrenceRuleServiceKey);
    const rows = await svc.listRules(orgId);
    return json({ recurrenceRules: rows });
  });

export const POST: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgRoleForId(event, orgId, ['OWNER', 'ADMIN', 'EDITOR']);

    const body = await event.request.json();
    const data = createSchema.parse(body);

    const svc = event.locals.resolve(recurrenceRuleServiceKey);
    const row = await svc.createRule({
      organizationId: orgId,
      fieldId: data.fieldId,
      frequency: data.frequency,
      interval: data.interval ?? 1,
      byDay: data.byDay ?? null,
      windowStartUtc: new Date(data.windowStartUtc),
      windowEndUtc: new Date(data.windowEndUtc),
      blackoutDates: data.blackoutDates ?? null
    });

    return json({ recurrenceRule: row }, { status: 201 });
  });

