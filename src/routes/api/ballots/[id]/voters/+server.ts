import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { ballots, ballotVoters, voters } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/server/middleware';
import { idSchema } from '$lib/validation';

const addVotersSchema = z.object({
	voter_emails: z
		.array(z.string().email('Invalid email'))
		.min(1, 'At least one voter email is required')
});

// GET /api/ballots/[id]/voters - Get voters for a specific ballot
export const GET: RequestHandler = async (event) =>
	withAuth(event, async ({ params }, user) => {
		try {
			if (!user) {
				return json({ error: 'Unauthorized' }, { status: 401 });
			}

			const ballotId = idSchema.parse(params).id;

			// Check if user owns this ballot
			const [ballot] = await db
				.select()
				.from(ballots)
				.where(and(eq(ballots.id, ballotId), eq(ballots.creator_id, user.id)))
				.limit(1);

			if (!ballot) {
				return json({ error: 'Ballot not found' }, { status: 404 });
			}

			// Get direct voters for this ballot
			const ballotVotersList = await db
				.select({
					id: voters.id,
					email: voters.email,
					name: voters.name,
					user_id: voters.user_id,
					added_at: ballotVoters.added_at
				})
				.from(ballotVoters)
				.innerJoin(voters, eq(ballotVoters.voter_id, voters.id))
				.where(eq(ballotVoters.ballot_id, ballotId))
				.orderBy(ballotVoters.added_at);

			return json({ voters: ballotVotersList });
		} catch (error) {
			console.error('Error fetching ballot voters:', error);
			return json({ error: 'Internal server error' }, { status: 500 });
		}
	});

// POST /api/ballots/[id]/voters - Add voters to a ballot
export const POST: RequestHandler = (event) =>
	withAuth(event, async ({ params, request }, user) => {
		try {
			if (!user) {
				return json({ error: 'Unauthorized' }, { status: 401 });
			}

			const ballotId = idSchema.parse(params).id;
			const body = await request.json();
			const validatedData = addVotersSchema.parse(body);

			// Check if user owns this ballot
			const [ballot] = await db
				.select()
				.from(ballots)
				.where(and(eq(ballots.id, ballotId), eq(ballots.creator_id, user.id)))
				.limit(1);

			if (!ballot) {
				return json({ error: 'Ballot not found' }, { status: 404 });
			}

			// Create or get existing voters
			const voterRecords = [];
			for (const email of validatedData.voter_emails) {
				// Check if voter already exists
				const [existingVoter = (await db.insert(voters).values({ email }).returning())?.[0]] =
					await db.select().from(voters).where(eq(voters.email, email)).limit(1);

				// Check if voter is already associated with this ballot
				const [existingAssociation] = await db
					.select()
					.from(ballotVoters)
					.where(
						and(eq(ballotVoters.ballot_id, ballotId), eq(ballotVoters.voter_id, existingVoter.id))
					)
					.limit(1);

				if (!existingAssociation) {
					voterRecords.push(existingVoter);
				}
			}

			// Add new voters to the ballot
			if (voterRecords.length > 0) {
				const ballotVoterInserts = voterRecords.map((voter) => ({
					ballot_id: ballotId,
					voter_id: voter.id
				}));

				await db.insert(ballotVoters).values(ballotVoterInserts);
			}

			return json(
				{
					message: `Added ${voterRecords.length} voters to ballot`,
					addedVoters: voterRecords.length
				},
				{ status: 201 }
			);
		} catch (error) {
			if (error instanceof z.ZodError) {
				return json({ error: 'Validation error', details: z.flattenError(error) }, { status: 400 });
			}
			console.error('Error adding voters to ballot:', error);
			return json({ error: 'Internal server error' }, { status: 500 });
		}
	});

// DELETE /api/ballots/[id]/voters - Remove a voter from a ballot
export const DELETE: RequestHandler = async (event) =>
	withAuth(event, async ({ params, url }, user) => {
		const { id: ballotId } = idSchema.parse(params);
		const voterId = url.searchParams.get('voter_id');
		if (!voterId) {
			return json({ error: 'voter_id parameter is required' }, { status: 400 });
		}

		// Check if user owns this ballot
		const [ballot] = await db
			.select()
			.from(ballots)
			.where(and(eq(ballots.id, ballotId), eq(ballots.creator_id, user.id)))
			.limit(1);

		if (!ballot) {
			return json({ error: 'Ballot not found' }, { status: 404 });
		}

		// Remove the voter from the ballot
		await db
			.delete(ballotVoters)
			.where(and(eq(ballotVoters.ballot_id, ballotId), eq(ballotVoters.voter_id, voterId)));

		return json({ message: 'Voter removed from ballot successfully' });
	});
