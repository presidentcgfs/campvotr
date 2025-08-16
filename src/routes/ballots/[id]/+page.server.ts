import { idSchema } from '$lib/validation';
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import z from 'zod';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { voteServiceKey } from '$lib/services/vote-service';
import { withAuthRedirect } from '$lib/services/middleware';

export const load = withAuthRedirect<PageServerLoad>(
	async ({ locals: { user, resolve }, url, params, depends }) => {
		depends('app:ballots');

		const { id } = idSchema.parse(params);
		if (!id) {
			return redirect(303, '/ballots');
		}

		const ballot = await resolve(ballotServiceKey).getBallot(id, user.id);
		if (!ballot) {
			return redirect(303, '/ballots');
		}
		return {
			ballot
		};
	}
);

const voteSchema = z.object({
	vote_choice: z.enum(['yea', 'nay', 'abstain']),
	ballot_id: z.uuid()
});
export const actions = {
	async vote({ request, locals: { user, resolve } }) {
		if (!user) {
			return { error: 'Unauthorized' };
		}
		const formData = Object.fromEntries(await request.formData());

		const validatedData = voteSchema.parse(formData);

		const vote = await resolve(voteServiceKey).castVote({
			...validatedData,
			user_id: user.id
		});
		return { sucess: true };
	},
	async openVoting({ request, locals: { user } }) {
		if (!user) {
			return { error: 'Unauthorized' };
		}
		const formData = Object.fromEntries(await request.formData());
	}
};
