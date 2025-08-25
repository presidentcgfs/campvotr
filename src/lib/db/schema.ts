import {
	pgTable,
	uuid,
	varchar,
	text,
	timestamp,
	pgEnum,
	decimal,
	integer,
	uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const voteChoiceEnum = pgEnum('vote_choice', ['yea', 'nay', 'abstain']);
export const ballotStatusEnum = pgEnum('ballot_status', ['draft', 'open', 'closed']);
export const votingThresholdEnum = pgEnum('voting_threshold', [
	'simple_majority',
	'supermajority',
	'unanimous',
	'custom'
]);
export const notificationTypeEnum = pgEnum('notification_type', [
	'new_ballot',
	'voting_reminder',
	'voting_closed',
	'voting_opened'
]);

// Admin/user roles and vote events
export const actorRoleEnum = pgEnum('actor_role', ['user', 'admin', 'owner']);
export const voteEventTypeEnum = pgEnum('vote_event_type', ['cast', 'override', 'clear']);

// Organization roles enum
export const orgRoleEnum = pgEnum('org_role', ['OWNER', 'ADMIN', 'EDITOR', 'MEMBER', 'VIEWER']);

// Organizations
export const organizations = pgTable('organizations', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: varchar('name', { length: 255 }).notNull(),
	slug: varchar('slug', { length: 64 }).notNull().unique(),
	logoUrl: text('logo_url').$name('logo_url'),
	primaryColor: varchar('primary_color', { length: 7 })
		.$name('primary_color')
		.notNull()
		.default('#2563eb'),
	secondaryColor: varchar('secondary_color', { length: 7 })
		.$name('secondary_color')
		.notNull()
		.default('#64748b'),
	accentColor: varchar('accent_color', { length: 7 })
		.$name('accent_color')
		.notNull()
		.default('#22c55e'),
	primaryDomain: varchar('primary_domain', { length: 255 }).$name('primary_domain').unique(),
	// Optional org-level tie-breaker designation (Supabase auth user id)
	tieBreakerUserId: uuid('tie_breaker_user_id').$name('tie_breaker_user_id'),
	creatorId: uuid('creator_id').$name('creator_id'),
	createdAt: timestamp('created_at').$name('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').$name('updated_at').defaultNow().notNull()
}).enableRLS();

// Organization memberships
export const organizationMemberships = pgTable(
	'organization_memberships',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.$name('organization_id')
			.references(() => organizations.id, { onDelete: 'cascade' })
			.notNull(),
		userId: uuid('user_id').$name('user_id').notNull(),
		role: orgRoleEnum('role').notNull().default('MEMBER'),
		createdAt: timestamp('created_at').$name('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').$name('updated_at').defaultNow().notNull()
	},
	(table) => ({
		org_user_unique: uniqueIndex('org_user_unique').on(table.organizationId, table.userId)
	})
).enableRLS();

// Organization invites (pending memberships by email)
export const organizationInvites = pgTable(
	'organization_invites',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.$name('organization_id')
			.references(() => organizations.id, { onDelete: 'cascade' })
			.notNull(),
		email: varchar('email', { length: 255 }).notNull(),
		role: orgRoleEnum('role').notNull().default('MEMBER'),
		createdAt: timestamp('created_at').$name('created_at').defaultNow().notNull(),
		acceptedAt: timestamp('accepted_at').$name('accepted_at'),
		updatedAt: timestamp('updated_at').$name('updated_at').defaultNow().notNull()
	},
	(table) => ({
		org_email_unique: uniqueIndex('org_email_unique').on(table.organizationId, table.email)
	})
).enableRLS();

// Tables
export const voters = pgTable('voters', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	name: varchar('name', { length: 255 }),
	userId: uuid('user_id').$name('user_id'), // nullable for non-registered users
	createdAt: timestamp('created_at').$name('created_at').defaultNow().notNull()
}).enableRLS();

export const voterLists = pgTable('voter_lists', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: varchar('name', { length: 255 }).notNull(),
	description: text('description'),
	createdBy: uuid('created_by').$name('created_by').notNull(),
	organizationId: uuid('organization_id')
		.$name('organization_id')
		.references(() => organizations.id, {
			onDelete: 'cascade'
		}),
	createdAt: timestamp('created_at').$name('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').$name('updated_at').defaultNow().notNull()
}).enableRLS();

export const voterListMembers = pgTable('voter_list_members', {
	id: uuid('id').primaryKey().defaultRandom(),
	voterListId: uuid('voter_list_id')
		.$name('voter_list_id')
		.references(() => voterLists.id, { onDelete: 'cascade' })
		.notNull(),
	voterId: uuid('voter_id')
		.$name('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	addedAt: timestamp('added_at').$name('added_at').defaultNow().notNull()
}).enableRLS();

export const ballots = pgTable('ballots', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description').notNull(),
	creatorId: uuid('creator_id').$name('creator_id').notNull(),
	organizationId: uuid('organization_id')
		.$name('organization_id')
		.references(() => organizations.id, {
			onDelete: 'cascade'
		}),
	voterListId: uuid('voter_list_id')
		.$name('voter_list_id')
		.references(() => voterLists.id),
	googleGroupId: uuid('google_group_id').$name('google_group_id'),
	createdAt: timestamp('created_at').$name('created_at').defaultNow().notNull(),
	votingOpensAt: timestamp('voting_opens_at').$name('voting_opens_at').notNull(),
	votingClosesAt: timestamp('voting_closes_at').$name('voting_closes_at').notNull(),
	votingThreshold: votingThresholdEnum('voting_threshold')
		.$name('voting_threshold')
		.default('simple_majority')
		.notNull(),
	thresholdPercentage: decimal('threshold_percentage', { precision: 5, scale: 2 }).$name(
		'threshold_percentage'
	),
	quorumRequired: integer('quorum_required').$name('quorum_required'),
	status: ballotStatusEnum('status').default('draft').notNull(),
	// Optional per-ballot override for tie-breaker (Supabase auth user id)
	tieBreakerUserId: uuid('tie_breaker_user_id').$name('tie_breaker_user_id'),
	// Audit of tie-break resolution
	tieBreakResolvedAt: timestamp('tie_break_resolved_at').$name('tie_break_resolved_at'),
	tieBreakResolutionNote: text('tie_break_resolution_note').$name('tie_break_resolution_note')
}).enableRLS();

export const ballotVoters = pgTable('ballot_voters', {
	id: uuid('id').primaryKey().defaultRandom(),
	ballotId: uuid('ballot_id')
		.$name('ballot_id')
		.references(() => ballots.id, { onDelete: 'cascade' })
		.notNull(),
	voterId: uuid('voter_id')
		.$name('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	addedAt: timestamp('added_at').$name('added_at').defaultNow().notNull()
}).enableRLS();

export const votes = pgTable(
	'votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ballotId: uuid('ballot_id')
			.$name('ballot_id')
			.references(() => ballots.id, { onDelete: 'cascade' })
			.notNull(),
		voterId: uuid('voter_id')
			.$name('voter_id')
			.references(() => voters.id, { onDelete: 'cascade' })
			.notNull(),
		voteChoice: voteChoiceEnum('vote_choice').$name('vote_choice').notNull(),

		votedAt: timestamp('voted_at').$name('voted_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').$name('updated_at').defaultNow().notNull()
	},
	(table) => ({
		votesUnique: uniqueIndex('votes_ballot_voter_unique').on(table.ballotId, table.voterId)
	})
).enableRLS();

export const voteEvents = pgTable('vote_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	ballotId: uuid('ballot_id')
		.$name('ballot_id')
		.references(() => ballots.id, { onDelete: 'cascade' })
		.notNull(),
	voterId: uuid('voter_id')
		.$name('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	actorUserId: uuid('actor_user_id').$name('actor_user_id').notNull(),
	actorRole: actorRoleEnum('actor_role').$name('actor_role').notNull(),
	eventType: voteEventTypeEnum('event_type').$name('event_type').notNull(),
	previousChoice: voteChoiceEnum('previous_choice').$name('previous_choice'),
	newChoice: voteChoiceEnum('new_choice').$name('new_choice'),
	reason: text('reason'),
	createdAt: timestamp('created_at').$name('created_at').defaultNow().notNull()
}).enableRLS();

export const tieBreakerVotes = pgTable(
	'tie_breaker_votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ballotId: uuid('ballot_id')
			.$name('ballot_id')
			.references(() => ballots.id, { onDelete: 'cascade' })
			.notNull(),
		userId: uuid('user_id').$name('user_id').notNull(),
		voteChoice: voteChoiceEnum('vote_choice').$name('vote_choice').notNull(),
		note: text('note'),
		ipAddress: varchar('ip_address', { length: 64 }).$name('ip_address'),
		createdAt: timestamp('created_at').$name('created_at').defaultNow().notNull()
	},
	(table) => ({
		uniqueBallot: uniqueIndex('tie_breaker_votes_ballot_unique').on(table.ballotId)
	})
).enableRLS();

export const notifications = pgTable('notifications', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').$name('user_id').notNull(),
	ballotId: uuid('ballot_id')
		.$name('ballot_id')
		.references(() => ballots.id, { onDelete: 'cascade' }),
	type: notificationTypeEnum('type').notNull(),
	message: text('message').notNull(),
	sentAt: timestamp('sent_at').$name('sent_at').defaultNow().notNull(),
	readAt: timestamp('read_at').$name('read_at')
}).enableRLS();

// Relations
export const votersRelations = relations(voters, ({ many }) => ({
	voterListMembers: many(voterListMembers),
	ballotVoters: many(ballotVoters),
	votes: many(votes)
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
	memberships: many(organizationMemberships),
	ballots: many(ballots),
	voterLists: many(voterLists)
}));

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
	organization: one(organizations, {
		fields: [organizationMemberships.organizationId],
		references: [organizations.id]
	})
}));

export const voterListsRelations = relations(voterLists, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [voterLists.organizationId],
		references: [organizations.id]
	}),
	members: many(voterListMembers),
	ballots: many(ballots)
}));

export const voterListMembersRelations = relations(voterListMembers, ({ one }) => ({
	voterList: one(voterLists, {
		fields: [voterListMembers.voterListId],
		references: [voterLists.id]
	}),
	voter: one(voters, {
		fields: [voterListMembers.voterId],
		references: [voters.id]
	})
}));

export const ballotsRelations = relations(ballots, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [ballots.organizationId],
		references: [organizations.id]
	}),
	voterList: one(voterLists, {
		fields: [ballots.voterListId],
		references: [voterLists.id]
	}),
	ballotVoters: many(ballotVoters),
	votes: many(votes),
	notifications: many(notifications)
}));

export const ballotVotersRelations = relations(ballotVoters, ({ one }) => ({
	ballot: one(ballots, {
		fields: [ballotVoters.ballotId],
		references: [ballots.id]
	}),
	voter: one(voters, {
		fields: [ballotVoters.voterId],
		references: [voters.id]
	})
}));

export const votesRelations = relations(votes, ({ one }) => ({
	ballot: one(ballots, {
		fields: [votes.ballotId],
		references: [ballots.id]
	}),
	voter: one(voters, {
		fields: [votes.voterId],
		references: [voters.id]
	})
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	ballot: one(ballots, {
		fields: [notifications.ballotId],
		references: [ballots.id]
	})
}));
