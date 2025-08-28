import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { organizationServiceKey } from '$lib/services/org';
import { timeSlotServiceKey } from '$lib/services/timeslot-service';

const querySchema = z.object({
  fieldId: z.string().uuid().optional(),
  startUtc: z.string().datetime().optional(),
  endUtc: z.string().datetime().optional(),
  status: z.string().optional() // comma-list of statuses
});

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (event) => {
    const orgId = event.params.id!;
    const orgSvc = event.locals.resolve(organizationServiceKey);
    await orgSvc.requireOrgMembershipForId(event, orgId);

    const url = new URL(event.request.url);
    const data = querySchema.parse({
      fieldId: url.searchParams.get('fieldId') ?? undefined,
      startUtc: url.searchParams.get('startUtc') ?? undefined,
      endUtc: url.searchParams.get('endUtc') ?? undefined,
      status: url.searchParams.get('status') ?? undefined
    });

    const statuses = data.status?.split(',').filter(Boolean) as any[] | undefined;

    const svc = event.locals.resolve(timeSlotServiceKey);
    const rows = await svc.fetchAvailable({
      organizationId: orgId,
      fieldId: data.fieldId,
      startUtc: data.startUtc ? new Date(data.startUtc) : undefined,
      endUtc: data.endUtc ? new Date(data.endUtc) : undefined,
      status: statuses as any
    });

    return json({ timeSlots: rows });
  });

