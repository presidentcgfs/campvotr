import { z } from 'zod';

export const voteChoiceSchema = z.enum(['yea', 'nay', 'abstain']);
export const ballotStatusSchema = z.enum(['draft', 'open', 'closed']);
export const votingThresholdSchema = z.enum([
	'simple_majority',
	'supermajority',
	'unanimous',
	'custom'
]);

const datetime = z.coerce.date();

export const createBallotSchema = z
	.object({
		title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
		description: z.string().min(1, 'Description is required'),
		voting_opens_at: datetime,
		voting_closes_at: datetime,
		voting_threshold: votingThresholdSchema.default('simple_majority'),
		threshold_percentage: z
			.number()
			.min(0.01, 'Threshold must be at least 0.01%')
			.max(100, 'Threshold cannot exceed 100%')
			.optional(),
		quorum_required: z
			.number()
			.int('Quorum must be a whole number')
			.min(1, 'Quorum must be at least 1 voter')
			.optional(),
		voter_list_id: z.uuid().optional(),
		voter_emails: z.array(z.email('Invalid email')).optional(),
		google_group_id: z.uuid().optional()
	})
	.refine((data) => new Date(data.voting_closes_at) > new Date(data.voting_opens_at), {
		message: 'Voting close time must be after open time',
		path: ['voting_closes_at']
	})
	.refine(
		(data) =>
			data.voter_list_id ||
			data.google_group_id ||
			(data.voter_emails && data.voter_emails.length > 0),
		{
			message: 'Either voter list, Google Group, or individual voter emails must be provided',
			path: ['voter_list_id']
		}
	)
	.refine(
		(data) => {
			if (data.voting_threshold === 'custom') {
				return data.threshold_percentage !== undefined && data.threshold_percentage > 0;
			}
			return true;
		},
		{
			message: 'Custom threshold percentage is required when using custom threshold',
			path: ['threshold_percentage']
		}
	);

export const castVoteSchema = z.object({
	vote_choice: voteChoiceSchema
});
export const idSchema = z.object({
	id: z.uuid('Invalid ballot id')
});

export const authSchema = z.object({
	email: z.email('Invalid email format'),
	password: z.string().min(6, 'Password must be at least 6 characters')
});

export const updateBallotStatusSchema = z.object({
	status: ballotStatusSchema
});

export const openVotingSchema = z
	.object({
		action: z.literal('open_voting'),
		voting_opens_at: datetime,
		voting_closes_at: datetime,
		send_notifications: z.boolean().optional().default(true)
	})
	.refine((data) => new Date(data.voting_closes_at) > new Date(data.voting_opens_at), {
		message: 'Voting close time must be after open time',
		path: ['voting_closes_at']
	})
	.refine((data) => new Date(data.voting_opens_at) >= new Date(), {
		message: 'Voting open time cannot be in the past',
		path: ['voting_opens_at']
	});

export const orgRolesEnum = z.enum(['OWNER', 'ADMIN', 'EDITOR', 'MEMBER', 'VIEWER']);

export type OrgRole = z.infer<typeof orgRolesEnum>;
