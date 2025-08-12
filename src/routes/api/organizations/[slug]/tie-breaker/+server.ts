import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/server/middleware';
import { requireOrgRoleForSlug } from '$lib/server/org';
import { db } from '$lib/db';
import { organizations, organizationMemberships } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';

const bodySchema = z.object({
  userId: z.string().uuid().nullable().optional() // null to clear
});

export const POST: RequestHandler = async (event) =>
  withAuth(event, async (event, user) => {
    const slug = event.params.slug!;
    await requireOrgRoleForSlug(event, slug, ['OWNER', 'ADMIN']);
    const body = await event.request.json();
    const { userId } = bodySchema.parse(body);

    // Fetch org by slug
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    if (!org) return json({ error: 'Organization not found' }, { status: 404 });

    if (userId) {
      // Validate membership
      const [m] = await db
        .select()
        .from(organizationMemberships)
        .where(and(eq(organizationMemberships.organization_id, org.id), eq(organizationMemberships.user_id, userId)))
        .limit(1);
      if (!m) return json({ error: 'User is not a member of this organization' }, { status: 400 });
    }

    const [updated] = await db
      .update(organizations)
      .set({ tie_breaker_user_id: userId ?? null, updated_at: new Date() })
      .where(eq(organizations.id, org.id))
      .returning();

    return json({ organization: updated });
  });

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (event, user) => {
    const slug = event.params.slug!;
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
    if (!org) return json({ error: 'Organization not found' }, { status: 404 });
    return json({ tie_breaker_user_id: (org as any).tie_breaker_user_id ?? null });
  });

