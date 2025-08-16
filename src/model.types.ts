import type { InferSelectModel } from 'drizzle-orm';
import type * as DbSchema from './lib/db/schema';
import type { authUsers } from 'drizzle-orm/supabase';

export type Organization = InferSelectModel<typeof DbSchema.organizations>;
export type OrganizationMembership = InferSelectModel<typeof DbSchema.organizationMemberships>;
export type OrganizationInvite = InferSelectModel<typeof DbSchema.organizationInvites>;
export type User = InferSelectModel<typeof authUsers>;
export type Ballot = InferSelectModel<typeof DbSchema.ballots>;
export type BallotVoter = InferSelectModel<typeof DbSchema.ballotVoters>;
export type Vote = InferSelectModel<typeof DbSchema.votes>;
export type VoteEvent = InferSelectModel<typeof DbSchema.voteEvents>;
export type Notification = InferSelectModel<typeof DbSchema.notifications>;
