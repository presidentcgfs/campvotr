import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { voters } from '$lib/db/schema';
import { eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/server/middleware';

const createVoterSchema = z.object({
	email: z.string().email('Invalid email'),
	name: z.string().optional()
});

const linkVoterSchema = z.object({
	email: z.string().email('Invalid email')
});

// GET /api/voters - Search voters by email or name
export const GET: RequestHandler = (event) =>
	withAuth(event, async ({ url }, user) => {
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const searchQuery = url.searchParams.get('search');
		const limit = parseInt(url.searchParams.get('limit') || '50');

		const base = db.select().from(voters);
		const voterResults = await (
			searchQuery
				? base.where(
						or(ilike(voters.email, `%${searchQuery}%`), ilike(voters.name, `%${searchQuery}%`))
					)
				: base
		)
			.limit(limit)
			.orderBy(voters.created_at);

		return json({ voters: voterResults });
	});

// POST /api/voters - Create a new voter or link existing voter to user
export const POST: RequestHandler = (event) =>
	withAuth(event, async ({ request }, user) => {
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const action = body.action; // 'create' or 'link'

		if (action === 'link') {
			// Link current user to existing voter record
			const validatedData = linkVoterSchema.parse(body);

			// Find voter by email
			const [existingVoter] = await db
				.select()
				.from(voters)
				.where(eq(voters.email, validatedData.email))
				.limit(1);

			if (!existingVoter) {
				return json({ error: 'Voter not found' }, { status: 404 });
			}

			if (existingVoter.user_id) {
				return json({ error: 'Voter already linked to a user' }, { status: 400 });
			}

			// Link the voter to the current user
			const [updatedVoter] = await db
				.update(voters)
				.set({ user_id: user.id })
				.where(eq(voters.id, existingVoter.id))
				.returning();

			return json({ voter: updatedVoter });
		} else {
			// Create new voter
			const validatedData = createVoterSchema.parse(body);

			// Check if voter already exists
			const [existingVoter] = await db
				.select()
				.from(voters)
				.where(eq(voters.email, validatedData.email))
				.limit(1);

			if (existingVoter) {
				return json({ error: 'Voter with this email already exists' }, { status: 400 });
			}

			// Create new voter
			const [newVoter] = await db
				.insert(voters)
				.values({
					email: validatedData.email,
					name: validatedData.name
				})
				.returning();

			return json({ voter: newVoter }, { status: 201 });
		}
	});
