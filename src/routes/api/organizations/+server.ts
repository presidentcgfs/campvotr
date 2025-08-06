import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { organizations, organizationMemberships } from '$lib/db/schema';
import { withAuth } from '$lib/server/middleware';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async (event) =>
  withAuth(event, async (event, user) => {
    // List orgs where user is a member
    const rows = await db
      .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organization_id, organizations.id))
      .where(eq(organizationMemberships.user_id, user.id));
    return json({ organizations: rows });
  });

