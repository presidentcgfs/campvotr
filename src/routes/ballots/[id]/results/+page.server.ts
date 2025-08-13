import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { idSchema } from '$lib/validation';
import { db, ballots, organizations, voters, votes } from '$lib/db';
import { BallotService } from '$lib/db/queries';
import { and, desc, eq } from 'drizzle-orm';
import { fetchMembership } from '$lib/server/org';
import { authUsers } from 'drizzle-orm/supabase';

export const load: PageServerLoad = async ({ locals, params, url, depends }) => {
	depends('app:ballots');
	const user = locals.user;
	if (!user) {
		throw redirect(303, `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}

	const { id } = idSchema.parse(params);

	// Fetch ballot regardless of access so we can evaluate org admin permissions
	const [baseBallot] = await db.select().from(ballots).where(eq(ballots.id, id)).limit(1);
	if (!baseBallot) {
		throw error(404, 'Ballot not found');
	}

	// Creator or assigned voter access
	const accessibleBallot = await BallotService.getBallot(id, user.id);
	const hasCreatorOrVoterAccess = !!accessibleBallot;

	// Organization admin/owner access
	let isOrgAdmin = false;
	if (baseBallot.organization_id) {
		const m = await fetchMembership(user.id, baseBallot.organization_id);
		isOrgAdmin = !!m && (m.role === 'ADMIN' || m.role === 'OWNER');
	}

	if (!hasCreatorOrVoterAccess && !isOrgAdmin && baseBallot.creator_id !== user.id) {
		throw error(403, 'You do not have permission to view these results');
	}

	// Compute passing status and detailed votes
	const passingStatus = await BallotService.getBallotPassingStatus(id);

	const detailedVotes = await db
		.select({
			id: votes.id,
			vote_choice: votes.vote_choice,
			voted_at: votes.voted_at,
			updated_at: votes.updated_at,
			voter_id: votes.voter_id,
			voter_email: voters.email,
			voter_name: voters.name
		})
		.from(votes)
		.innerJoin(voters, eq(votes.voter_id, voters.id))
		.where(eq(votes.ballot_id, id))
		.orderBy(desc(votes.voted_at));

	// Organization details for branding
	let organization: any = null;
	if (baseBallot.organization_id) {
		[organization] = await db
			.select()
			.from(organizations)
			.where(eq(organizations.id, baseBallot.organization_id))
			.limit(1);
	}

	// Attempt to fetch creator email (optional)
	let creator_email: string | null = null;
	try {
		const [{ authUsers: creator } = {} as any] = await db
			.select()
			.from(authUsers)
			.where(eq(authUsers.id, baseBallot.creator_id))
			.limit(1);
		creator_email = (creator as any)?.email ?? null;
	} catch (e) {
		creator_email = null;
	}

	return {
		ballot: baseBallot,
		creator_email,
		passingStatus,
		voteCounts: passingStatus.vote_counts,
		votes: detailedVotes,
		organization
	};
};

