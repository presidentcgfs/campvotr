import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { voterLists, voterListMembers, voters } from '$lib/db/schema';
import { getUser } from '$lib/server/auth';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const createVoterListSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
	description: z.string().optional(),
	voterEmails: z
		.transform((v) => {
			const r = Array.isArray(v) ? v.flatMap((e) => e.split(/\s|,|;|\n/)) : v.split(/\s|,|;|\n/);
			console.log({ r });
			return r;
		})
		.pipe(z.email().array().min(1, 'At least one voter email is required'))
});

// GET /api/voter-lists - Get all voter lists for the authenticated user
export const GET: RequestHandler = async (event) => {
	try {
		const user = (event as any).locals?.user ?? (await getUser(event));
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userVoterLists = await db
			.select({
				id: voterLists.id,
				name: voterLists.name,
				description: voterLists.description,
				created_at: voterLists.created_at,
				updated_at: voterLists.updated_at,
				voterCount: sql`COUNT(voter_list_members.id)`
			})
			.from(voterLists)
			.leftJoin(voterListMembers, eq(voterLists.id, voterListMembers.voter_list_id))
			.where(eq(voterLists.created_by, user.id))
			.groupBy(voterLists.id)
			.orderBy(voterLists.created_at);

		return json({ voterLists: userVoterLists });
	} catch (error) {
		console.error('Error fetching voter lists:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// POST /api/voter-lists - Create a new voter list
export const POST: RequestHandler = async (event) => {
	try {
		const user = (event as any).locals?.user ?? (await getUser(event));
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await event.request.json();
		const { success, data: validatedData, error: details } = createVoterListSchema.safeParse(body);
		if (success === false) {
			return json({ error: 'Validation error', details: z.flattenError(details) }, { status: 400 });
		}

		// Create the voter list
		const [newVoterList] = await db
			.insert(voterLists)
			.values({
				name: validatedData.name,
				description: validatedData.description,
				created_by: user.id
			})
			.returning();

		// Add voters if provided
		if (validatedData.voterEmails?.length) {
			// Create or get existing voters
			const voterRecords = [];
			for (const email of validatedData.voterEmails) {
				// Check if voter already exists
				const [existingVoter = (await db.insert(voters).values({ email }).returning())?.[0]] =
					await db.select().from(voters).where(eq(voters.email, email)).limit(1);

				voterRecords.push(existingVoter);
			}

			// Add voters to the list
			const memberInserts = voterRecords.map((voter) => ({
				voter_list_id: newVoterList.id,
				voter_id: voter.id
			}));

			await db.insert(voterListMembers).values(memberInserts);
		}

		return json({ voterList: newVoterList }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json({ error: 'Validation error', details: z.flattenError(error) }, { status: 400 });
		}
		console.error('Error creating voter list:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
