import type { Actions, PageServerLoad } from './$types';
import { withAuthRedirect } from '$lib/services/middleware';
import { recurrenceRuleServiceKey } from '$lib/services/recurrence-rule-service';
import { fieldServiceKey } from '$lib/services/field-service';

export const load = withAuthRedirect<PageServerLoad>(async ({ locals: { resolve, organizationContext } }) => {
  const orgId = organizationContext?.organization?.id;
  if (!orgId) return { orgId: null, rules: [], fields: [] } as any;
  const rr = resolve(recurrenceRuleServiceKey);
  const fs = resolve(fieldServiceKey);
  const [rules, fields] = await Promise.all([
    rr.listRules(orgId),
    fs.listFields(orgId)
  ]);
  return { orgId, rules, fields } as const;
});

export const actions: Actions = {
  create: withAuthRedirect(async ({ request, locals: { resolve, organizationContext } }) => {
    const orgId = organizationContext?.organization?.id;
    if (!orgId) return { error: 'No organization in context' };

    const form = await request.formData();
    const fieldId = String(form.get('fieldId') || '');
    const frequency = String(form.get('frequency') || 'daily') as any;
    const interval = Number(form.get('interval') || '1');
    const byDay = (form.get('byDay') as string) || null;
    const windowStartUtc = new Date(String(form.get('windowStartUtc') || ''));
    const windowEndUtc = new Date(String(form.get('windowEndUtc') || ''));
    const blackoutDates = (form.get('blackoutDates') as string) || null;

    if (!fieldId) return { error: 'Field is required' };
    if (!(windowStartUtc instanceof Date) || isNaN(windowStartUtc.getTime())) return { error: 'Invalid start' };
    if (!(windowEndUtc instanceof Date) || isNaN(windowEndUtc.getTime())) return { error: 'Invalid end' };

    const svc = resolve(recurrenceRuleServiceKey);
    const created = await svc.createRule({
      organizationId: orgId,
      fieldId,
      frequency,
      interval,
      byDay,
      windowStartUtc,
      windowEndUtc,
      blackoutDates
    });

    return { success: true, created };
  }) as any
};

