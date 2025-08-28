import type { Actions, PageServerLoad } from './$types';
import { withAuthRedirect } from '$lib/services/middleware';
import { fieldServiceKey } from '$lib/services/field-service';

export const load = withAuthRedirect<PageServerLoad>(async ({ locals: { resolve, organizationContext } }) => {
  const orgId = organizationContext?.organization?.id;
  const svc = resolve(fieldServiceKey);
  const fields = orgId ? await svc.listFields(orgId) : [];
  return { orgId, fields };
});

export const actions: Actions = {
  create: withAuthRedirect(async ({ request, locals: { resolve, organizationContext } }) => {
    const orgId = organizationContext?.organization?.id;
    if (!orgId) return { error: 'No organization in context' };
    const form = await request.formData();
    const name = String(form.get('name') || '').trim();
    const location = (form.get('location') as string) || '';
    const notes = (form.get('notes') as string) || '';
    const capacity = Number(form.get('capacity') || '1');
    const active = (form.get('active') as string) === 'on';
    if (!name) return { error: 'Name is required' };

    const svc = resolve(fieldServiceKey);
    const created = await svc.createField({ organizationId: orgId, name, location, notes, capacity, active });
    return { success: true, created };
  }) as any,

  delete: withAuthRedirect(async ({ request, locals: { resolve, organizationContext } }) => {
    const orgId = organizationContext?.organization?.id;
    if (!orgId) return { error: 'No organization in context' };
    const form = await request.formData();
    const id = String(form.get('id') || '');
    if (!id) return { error: 'Missing id' };

    const svc = resolve(fieldServiceKey);
    await svc.deleteField(orgId, id);
    return { success: true };
  }) as any
};

