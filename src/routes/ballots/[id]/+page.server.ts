import { ballots, ballotVoters, db, voters } from '$lib/db';
import { idSchema } from '$lib/validation';
import { and, eq, or } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { BallotService, VoteService } from '$lib/db/queries';
import z from 'zod';

export const load: PageServerLoad = async ({ locals: { user }, url, params, depends }) => {
	depends('app:ballots');
	if (!user) {
		throw redirect(303, `/auth?redirectTo=${encodeURIComponent(url.pathname + url.search)}`);
	}
	const { id } = idSchema.parse(params);
	if (!id) {
		throw redirect(303, '/ballots');
	}

	const ballot = await BallotService.getBallot(id, user.id);
	if (!ballot) {
		throw redirect(303, '/ballots');
	}
	return {
		ballot
	};
};

const voteSchema = z.object({
	vote_choice: z.enum(['yea', 'nay', 'abstain']),
	ballot_id: z.uuid()
});
export const actions = {
	async vote({ request, locals: { user } }) {
		if (!user) {
			return { error: 'Unauthorized' };
		}
		const formData = Object.fromEntries(await request.formData());

		const validatedData = voteSchema.parse(formData);

		const vote = await VoteService.castVote({
			...validatedData,
			user_id: user.id
		});
		console.dir({ vote });
		return { sucess: true };
	},
	async openVoting({ request, locals: { user } }) {
		if (!user) {
			return { error: 'Unauthorized' };
		}
		const formData = Object.fromEntries(await request.formData());
	}
};
