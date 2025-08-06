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
	logo_url: text('logo_url'),
	primary_color: varchar('primary_color', { length: 7 }).notNull().default('#2563eb'),
	secondary_color: varchar('secondary_color', { length: 7 }).notNull().default('#64748b'),
	accent_color: varchar('accent_color', { length: 7 }).notNull().default('#22c55e'),
	primary_domain: varchar('primary_domain', { length: 255 }).unique(),

	created_at: timestamp('created_at').defaultNow().notNull(),
	updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Organization memberships
export const organizationMemberships = pgTable(
	'organization_memberships',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organization_id: uuid('organization_id')
			.references(() => organizations.id, { onDelete: 'cascade' })
			.notNull(),
		user_id: uuid('user_id').notNull(),
		role: orgRoleEnum('role').notNull().default('MEMBER'),
		created_at: timestamp('created_at').defaultNow().notNull(),
		updated_at: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => ({
		org_user_unique: uniqueIndex('org_user_unique').on(table.organization_id, table.user_id)
	})
);

// Organization invites (pending memberships by email)
export const organizationInvites = pgTable(
	'organization_invites',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organization_id: uuid('organization_id')
			.references(() => organizations.id, { onDelete: 'cascade' })
			.notNull(),
		email: varchar('email', { length: 255 }).notNull(),
		role: orgRoleEnum('role').notNull().default('MEMBER'),
		created_at: timestamp('created_at').defaultNow().notNull(),
		accepted_at: timestamp('accepted_at'),
		updated_at: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => ({
		org_email_unique: uniqueIndex('org_email_unique').on(table.organization_id, table.email)
	})
);

// Tables
export const voters = pgTable('voters', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	name: varchar('name', { length: 255 }),
	user_id: uuid('user_id'), // nullable for non-registered users
	created_at: timestamp('created_at').defaultNow().notNull()
});

export const voterLists = pgTable('voter_lists', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: varchar('name', { length: 255 }).notNull(),
	description: text('description'),
	created_by: uuid('created_by').notNull(),
	organization_id: uuid('organization_id').references(() => organizations.id, {
		onDelete: 'cascade'
	}),
	created_at: timestamp('created_at').defaultNow().notNull(),
	updated_at: timestamp('updated_at').defaultNow().notNull()
});

export const voterListMembers = pgTable('voter_list_members', {
	id: uuid('id').primaryKey().defaultRandom(),
	voter_list_id: uuid('voter_list_id')
		.references(() => voterLists.id, { onDelete: 'cascade' })
		.notNull(),
	voter_id: uuid('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	added_at: timestamp('added_at').defaultNow().notNull()
});

export const ballots = pgTable('ballots', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description').notNull(),
	creator_id: uuid('creator_id').notNull(),
	organization_id: uuid('organization_id').references(() => organizations.id, {
		onDelete: 'cascade'
	}),
	voter_list_id: uuid('voter_list_id').references(() => voterLists.id),
	google_group_id: uuid('google_group_id'),
	created_at: timestamp('created_at').defaultNow().notNull(),
	voting_opens_at: timestamp('voting_opens_at').notNull(),
	voting_closes_at: timestamp('voting_closes_at').notNull(),
	voting_threshold: votingThresholdEnum('voting_threshold').default('simple_majority').notNull(),
	threshold_percentage: decimal('threshold_percentage', { precision: 5, scale: 2 }),
	quorum_required: integer('quorum_required'),
	status: ballotStatusEnum('status').default('draft').notNull()
});

export const ballotVoters = pgTable('ballot_voters', {
	id: uuid('id').primaryKey().defaultRandom(),
	ballot_id: uuid('ballot_id')
		.references(() => ballots.id, { onDelete: 'cascade' })
		.notNull(),
	voter_id: uuid('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	added_at: timestamp('added_at').defaultNow().notNull()
});

export const votes = pgTable(
	'votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ballot_id: uuid('ballot_id')
			.references(() => ballots.id, { onDelete: 'cascade' })
			.notNull(),
		voter_id: uuid('voter_id')
			.references(() => voters.id, { onDelete: 'cascade' })
			.notNull(),
		vote_choice: voteChoiceEnum('vote_choice').notNull(),
		voted_at: timestamp('voted_at').defaultNow().notNull(),
		updated_at: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => ({
		votesUnique: uniqueIndex('votes_ballot_voter_unique').on(table.ballot_id, table.voter_id)
	})
);

export const voteEvents = pgTable('vote_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	ballot_id: uuid('ballot_id')
		.references(() => ballots.id, { onDelete: 'cascade' })
		.notNull(),
	voter_id: uuid('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	actor_user_id: uuid('actor_user_id').notNull(),
	actor_role: actorRoleEnum('actor_role').notNull(),
	event_type: voteEventTypeEnum('event_type').notNull(),
	previous_choice: voteChoiceEnum('previous_choice'),
	new_choice: voteChoiceEnum('new_choice'),
	reason: text('reason'),
	created_at: timestamp('created_at').defaultNow().notNull()
});

export const notifications = pgTable('notifications', {
	id: uuid('id').primaryKey().defaultRandom(),
	user_id: uuid('user_id').notNull(),
	ballot_id: uuid('ballot_id').references(() => ballots.id, { onDelete: 'cascade' }),
	type: notificationTypeEnum('type').notNull(),
	message: text('message').notNull(),
	sent_at: timestamp('sent_at').defaultNow().notNull(),
	read_at: timestamp('read_at')
});

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
		fields: [organizationMemberships.organization_id],
		references: [organizations.id]
	})
}));

export const voterListsRelations = relations(voterLists, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [voterLists.organization_id],
		references: [organizations.id]
	}),
	members: many(voterListMembers),
	ballots: many(ballots)
}));

export const voterListMembersRelations = relations(voterListMembers, ({ one }) => ({
	voterList: one(voterLists, {
		fields: [voterListMembers.voter_list_id],
		references: [voterLists.id]
	}),
	voter: one(voters, {
		fields: [voterListMembers.voter_id],
		references: [voters.id]
	})
}));

export const ballotsRelations = relations(ballots, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [ballots.organization_id],
		references: [organizations.id]
	}),
	voterList: one(voterLists, {
		fields: [ballots.voter_list_id],
		references: [voterLists.id]
	}),
	ballotVoters: many(ballotVoters),
	votes: many(votes),
	notifications: many(notifications)
}));

export const ballotVotersRelations = relations(ballotVoters, ({ one }) => ({
	ballot: one(ballots, {
		fields: [ballotVoters.ballot_id],
		references: [ballots.id]
	}),
	voter: one(voters, {
		fields: [ballotVoters.voter_id],
		references: [voters.id]
	})
}));

export const votesRelations = relations(votes, ({ one }) => ({
	ballot: one(ballots, {
		fields: [votes.ballot_id],
		references: [ballots.id]
	}),
	voter: one(voters, {
		fields: [votes.voter_id],
		references: [voters.id]
	})
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
	ballot: one(ballots, {
		fields: [notifications.ballot_id],
		references: [ballots.id]
	})
}));
