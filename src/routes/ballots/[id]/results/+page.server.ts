import type { PageServerLoad } from './$types';
import { redirect, error } from '@sveltejs/kit';
import { idSchema } from '$lib/validation';
import { organizationServiceKey } from '$lib/services/org';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { adminVoteServiceKey } from '$lib/services/vote.admin-service';
import { userServiceKey } from '$lib/services/user-service';
import { withAuthRedirect } from '$lib/services/middleware';

export const load = withAuthRedirect<PageServerLoad>(async ({ locals, params, url, depends }) => {
	depends('app:ballots');
	const { id } = idSchema.parse(params);
	const user = locals.user;
	const ballotService = locals.resolve(ballotServiceKey);
	const orgService = locals.resolve(organizationServiceKey);
	const adminVoteService = locals.resolve(adminVoteServiceKey);
	const userService = locals.resolve(userServiceKey);
	// Fetch ballot regardless of access so we can evaluate org admin permissions
	const [baseBallot, orgMembership] = await Promise.all([
		ballotService.getBallot(id, user.id),
		orgService.fetchMembership(user.id, locals.organizationContext?.organization?.id!)
	]);

	if (!baseBallot) {
		throw error(404, 'Ballot not found');
	}

	const isOrgAdmin = orgMembership?.role === 'ADMIN' || orgMembership?.role === 'OWNER';
	const isCreator = baseBallot.creator_id == user.id;
	if (!(isOrgAdmin || isCreator)) {
		throw error(403, 'You do not have permission to view these results');
	}

	// Compute passing status and detailed votes
	const [passingStatus, detailedVotes, organization, creator] = await Promise.all([
		ballotService.getBallotPassingStatus(id),
		adminVoteService.retrieveBallotVotesForAdmin(id),
		orgService.fetchOrganization(baseBallot.organization_id!),
		userService.fetchUser(baseBallot.creator_id)
	]);

	return {
		ballot: baseBallot,
		creator_email: creator?.email,
		passingStatus,
		voteCounts: passingStatus.vote_counts,
		votes: detailedVotes,
		organization
	};
});
