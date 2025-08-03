import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { voterLists, voterListMembers, voters } from '$lib/db/schema';
import { getUser } from '$lib/server/auth';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const updateVoterListSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
	description: z.string().optional(),
	voterEmails: z
		.transform((val: string | string[]) => {
			const r = Array.isArray(val) ? val : val.split(/\s|,|;|\n/);
			console.log('v', val, r);
			return r;
		})
		.pipe(z.array(z.email()))
		.optional()
});

// GET /api/voter-lists/[id] - Get a specific voter list with its members
export const GET: RequestHandler = async (event) => {
	try {
		const user = (event as any).locals?.user ?? (await getUser(event));
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const voterListId = event.params.id;

		// Get the voter list
		const [voterList] = await db
			.select()
			.from(voterLists)
			.where(and(eq(voterLists.id, voterListId), eq(voterLists.created_by, user.id)))
			.limit(1);

		if (!voterList) {
			return json({ error: 'Voter list not found' }, { status: 404 });
		}

		// Get the voters in this list
		const voterMembers = await db
			.select({
				id: voters.id,
				email: voters.email,
				name: voters.name,
				user_id: voters.user_id,
				added_at: voterListMembers.added_at
			})
			.from(voterListMembers)
			.innerJoin(voters, eq(voterListMembers.voter_id, voters.id))
			.where(eq(voterListMembers.voter_list_id, voterListId))
			.orderBy(voterListMembers.added_at);

		return json({
			voterList: {
				...voterList,
				voters: voterMembers
			}
		});
	} catch (error) {
		console.error('Error fetching voter list:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// PUT /api/voter-lists/[id] - Update a voter list
export const PUT: RequestHandler = async (event) => {
	try {
		const user = (event as any).locals?.user ?? (await getUser(event));
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const voterListId = event.params.id;
		const body = await event.request.json();
		const validatedData = updateVoterListSchema.parse(body);

		// Check if user owns this voter list
		const [existingVoterList] = await db
			.select()
			.from(voterLists)
			.where(and(eq(voterLists.id, voterListId), eq(voterLists.created_by, user.id)))
			.limit(1);

		if (!existingVoterList) {
			return json({ error: 'Voter list not found' }, { status: 404 });
		}

		// Update the voter list
		const updateData: any = { updated_at: new Date() };
		if (validatedData.name !== undefined) updateData.name = validatedData.name;
		if (validatedData.description !== undefined) updateData.description = validatedData.description;

		const [updatedVoterList] = await db
			.update(voterLists)
			.set(updateData)
			.where(eq(voterLists.id, voterListId))
			.returning();

		// Update voters if provided
		if (validatedData.voterEmails !== undefined) {
			// Remove all existing members
			await db.delete(voterListMembers).where(eq(voterListMembers.voter_list_id, voterListId));

			// Add new voters
			if (validatedData.voterEmails.length > 0) {
				const voterRecords = [];
				for (const email of validatedData.voterEmails) {
					// Check if voter already exists
					let [existingVoter] = await db
						.select()
						.from(voters)
						.where(eq(voters.email, email))
						.limit(1);

					if (!existingVoter) {
						// Create new voter
						[existingVoter] = await db.insert(voters).values({ email }).returning();
					}

					voterRecords.push(existingVoter);
				}

				// Add voters to the list
				const memberInserts = voterRecords.map((voter) => ({
					voter_list_id: voterListId,
					voter_id: voter.id
				}));

				await db.insert(voterListMembers).values(memberInserts);
			}
		}

		return json({ voterList: updatedVoterList });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json({ error: 'Validation error', details: z.flattenError(error) }, { status: 400 });
		}
		console.error('Error updating voter list:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// DELETE /api/voter-lists/[id] - Delete a voter list
export const DELETE: RequestHandler = async (event) => {
	try {
		const user = (event as any).locals?.user ?? (await getUser(event));
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const voterListId = event.params.id;

		// Check if user owns this voter list
		const [existingVoterList] = await db
			.select()
			.from(voterLists)
			.where(and(eq(voterLists.id, voterListId), eq(voterLists.created_by, user.id)))
			.limit(1);

		if (!existingVoterList) {
			return json({ error: 'Voter list not found' }, { status: 404 });
		}

		// Delete the voter list (cascade will handle members)
		await db.delete(voterLists).where(eq(voterLists.id, voterListId));

		return json({ message: 'Voter list deleted successfully' });
	} catch (error) {
		console.error('Error deleting voter list:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
