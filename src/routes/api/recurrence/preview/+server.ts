import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { recurrenceRuleServiceKey } from '$lib/services/recurrence-rule-service';

export const POST: RequestHandler = async (event) =>
  withAuth(event, async (evt) => {
    try {
      const payload = await evt.request.json();
      const {
        organizationId,
        fieldId,
        frequency,
        interval,
        byDay,
        windowStartUtc,
        windowEndUtc,
        slotDurationMinutes
      } = payload || {};

      if (!organizationId) return new Response(JSON.stringify({ error: 'Missing organizationId' }), { status: 400 });
      if (!fieldId) return new Response(JSON.stringify({ error: 'Missing fieldId' }), { status: 400 });
      if (!frequency) return new Response(JSON.stringify({ error: 'Missing frequency' }), { status: 400 });
      const start = new Date(windowStartUtc);
      const end = new Date(windowEndUtc);
      if (isNaN(start.getTime()) || isNaN(end.getTime()))
        return new Response(JSON.stringify({ error: 'Invalid window start/end' }), { status: 400 });
      const mins = Number(slotDurationMinutes || 60);
      if (!(mins > 0)) return new Response(JSON.stringify({ error: 'Invalid slotDurationMinutes' }), { status: 400 });

      const svc = evt.locals.resolve(recurrenceRuleServiceKey);
      const slots = await svc.preview({
        frequency,
        interval,
        byDay: byDay ?? null,
        windowStartUtc: start,
        windowEndUtc: end
      }, mins);

      return new Response(JSON.stringify({ slots }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error: any) {
      return handleError(error);
    }
  });

