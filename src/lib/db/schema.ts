import {
	pgTable,
	uuid,
	varchar,
	text,
	timestamp,
	pgEnum,
	decimal,
	integer,
	uniqueIndex,
	json,
	date,
	check,
	time,
	jsonb
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { authUsers } from 'drizzle-orm/supabase';

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
	logoUrl: text('logo_url'),
	primaryColor: varchar('primary_color', { length: 7 }).notNull().default('#2563eb'),
	secondaryColor: varchar('secondary_color', { length: 7 }).notNull().default('#64748b'),
	accentColor: varchar('accent_color', { length: 7 }).notNull().default('#22c55e'),
	primaryDomain: varchar('primary_domain', { length: 255 }).unique(),
	// Optional org-level tie-breaker designation (Supabase auth user id)
	tieBreakerUserId: uuid('tie_breaker_user_id'),
	creatorId: uuid('creator_id'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
}).enableRLS();

// Organization memberships
export const organizationMemberships = pgTable(
	'organization_memberships',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		organizationId: uuid('organization_id')
			.references(() => organizations.id, { onDelete: 'cascade' })
			.notNull(),
		userId: uuid('user_id').notNull(),
		role: orgRoleEnum('role').notNull().default('MEMBER'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
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
			.references(() => organizations.id, { onDelete: 'cascade' })
			.notNull(),
		email: varchar('email', { length: 255 }).notNull(),
		role: orgRoleEnum('role').notNull().default('MEMBER'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		acceptedAt: timestamp('accepted_at'),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => ({
		org_email_unique: uniqueIndex('org_email_unique').on(table.organizationId, table.email)
	})
).enableRLS();

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
	organization: one(organizations, {
		fields: [organizationInvites.organizationId],
		references: [organizations.id]
	})
}));

// User Profiles
export const profiles = pgTable('profiles', {
	id: uuid('id').primaryKey(), // Uses authUser.id as primary key
	name: varchar('name', { length: 255 }),
	email: varchar('email', { length: 255 }).notNull(),
	avatarUrl: text('avatar_url'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
}).enableRLS();

// Tables
export const voters = pgTable('voters', {
	id: uuid('id').primaryKey().defaultRandom(),
	email: varchar('email', { length: 255 }).notNull().unique(),
	name: varchar('name', { length: 255 }),
	userId: uuid('user_id'), // nullable for non-registered users
	createdAt: timestamp('created_at').defaultNow().notNull()
}).enableRLS();

export const voterLists = pgTable('voter_lists', {
	id: uuid('id').primaryKey().defaultRandom(),
	name: varchar('name', { length: 255 }).notNull(),
	description: text('description'),
	createdBy: uuid('created_by').notNull(),
	organizationId: uuid('organization_id').references(() => organizations.id, {
		onDelete: 'cascade'
	}),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
}).enableRLS();

export const voterListMembers = pgTable('voter_list_members', {
	id: uuid('id').primaryKey().defaultRandom(),
	voterListId: uuid('voter_list_id')
		.references(() => voterLists.id, { onDelete: 'cascade' })
		.notNull(),
	voterId: uuid('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	addedAt: timestamp('added_at').defaultNow().notNull()
}).enableRLS();

export const ballots = pgTable('ballots', {
	id: uuid('id').primaryKey().defaultRandom(),
	title: varchar('title', { length: 255 }).notNull(),
	description: text('description').notNull(),
	creatorId: uuid('creator_id').notNull(),
	organizationId: uuid('organization_id').references(() => organizations.id, {
		onDelete: 'cascade'
	}),
	voterListId: uuid('voter_list_id').references(() => voterLists.id),
	googleGroupId: uuid('google_group_id'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	votingOpensAt: timestamp('voting_opens_at').notNull(),
	votingClosesAt: timestamp('voting_closes_at').notNull(),
	votingThreshold: votingThresholdEnum('voting_threshold').default('simple_majority').notNull(),
	thresholdPercentage: decimal('threshold_percentage', { precision: 5, scale: 2 }),
	quorumRequired: integer('quorum_required'),
	status: ballotStatusEnum('status').default('draft').notNull(),
	// Optional per-ballot override for tie-breaker (Supabase auth user id)
	tieBreakerUserId: uuid('tie_breaker_user_id'),
	// Audit of tie-break resolution
	tieBreakResolvedAt: timestamp('tie_break_resolved_at'),
	tieBreakResolutionNote: text('tie_break_resolution_note')
}).enableRLS();

export const ballotVoters = pgTable('ballot_voters', {
	id: uuid('id').primaryKey().defaultRandom(),
	ballotId: uuid('ballot_id')
		.references(() => ballots.id, { onDelete: 'cascade' })
		.notNull(),
	voterId: uuid('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	addedAt: timestamp('added_at').defaultNow().notNull()
}).enableRLS();

export const votes = pgTable(
	'votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ballotId: uuid('ballot_id')
			.references(() => ballots.id, { onDelete: 'cascade' })
			.notNull(),
		voterId: uuid('voter_id')
			.references(() => voters.id, { onDelete: 'cascade' })
			.notNull(),
		voteChoice: voteChoiceEnum('vote_choice').notNull(),

		votedAt: timestamp('voted_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull()
	},
	(table) => ({
		votesUnique: uniqueIndex('votes_ballot_voter_unique').on(table.ballotId, table.voterId)
	})
).enableRLS();

export const voteEvents = pgTable('vote_events', {
	id: uuid('id').primaryKey().defaultRandom(),
	ballotId: uuid('ballot_id')
		.references(() => ballots.id, { onDelete: 'cascade' })
		.notNull(),
	voterId: uuid('voter_id')
		.references(() => voters.id, { onDelete: 'cascade' })
		.notNull(),
	actorUserId: uuid('actor_user_id').notNull(),
	actorRole: actorRoleEnum('actor_role').notNull(),
	eventType: voteEventTypeEnum('event_type').notNull(),
	previousChoice: voteChoiceEnum('previous_choice'),
	newChoice: voteChoiceEnum('new_choice'),
	reason: text('reason'),
	createdAt: timestamp('created_at').defaultNow().notNull()
}).enableRLS();

export const tieBreakerVotes = pgTable(
	'tie_breaker_votes',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ballotId: uuid('ballot_id')
			.references(() => ballots.id, { onDelete: 'cascade' })
			.notNull(),
		userId: uuid('user_id').notNull(),
		voteChoice: voteChoiceEnum('vote_choice').notNull(),
		note: text('note'),
		ipAddress: varchar('ip_address', { length: 64 }),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => ({
		uniqueBallot: uniqueIndex('tie_breaker_votes_ballot_unique').on(table.ballotId)
	})
).enableRLS();

export const notifications = pgTable('notifications', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull(),
	ballotId: uuid('ballot_id').references(() => ballots.id, { onDelete: 'cascade' }),
	type: notificationTypeEnum('type').notNull(),
	message: text('message').notNull(),
	sentAt: timestamp('sent_at').defaultNow().notNull(),
	readAt: timestamp('read_at')
}).enableRLS();

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
	organizationMemberships: many(organizationMemberships)
}));

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

// =====================
// Field Draw — Enums
// =====================
export const timeSlotStatusEnum = pgEnum('time_slot_status', [
	'available',
	'held',
	'picked',
	'blocked'
]);

export const drawSessionStatusEnum = pgEnum('draw_session_status', [
	'scheduled',
	'active',
	'paused',
	'completed',
	'cancelled'
]);

export const turnStrategyEnum = pgEnum('turn_strategy', [
	'fixed',
	'randomized',
	'snake',
	'random',
	'round_robin'
]);
export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', [
	'daily',
	'weekly',
	'monthly'
]);

// =====================
// Field Draw — Core Tables (part 1)
// =====================
export const fields = pgTable('fields', {
	id: uuid('id').primaryKey().defaultRandom(),
	organizationId: uuid('organization_id')
		.references(() => organizations.id, { onDelete: 'cascade' })
		.notNull(),
	name: varchar('name', { length: 255 }).notNull(),
	location: varchar('location', { length: 255 }),
	notes: text('notes'),
	capacity: integer('capacity').default(1).notNull(),
	active: integer('active').default(1).notNull(), // 1=true, 0=false
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
}).enableRLS();

export const timeSlots = pgTable(
	'time_slots',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		drawSessionId: uuid('draw_session_id')
			.references(() => drawSessions.id, { onDelete: 'cascade' })
			.notNull(),
		fieldId: uuid('field_id')
			.references(() => fields.id, { onDelete: 'cascade' })
			.notNull(),
		startUtc: timestamp('start_utc', { mode: 'date' }).notNull(),
		endUtc: timestamp('end_utc', { mode: 'date' }).notNull(),
		startTime: time('start_time').notNull(),
		endTime: time('end_time').notNull(),
		status: timeSlotStatusEnum('status').default('available').notNull(),
		heldByUserId: uuid('held_by_user_id').references(() => participants.id, {
			onDelete: 'set null'
		}),
		roundNumber: integer('round_number'), // Track which round this slot was picked/assigned in
		weekday: integer('weekday').notNull(),
		holdExpiresAt: timestamp('hold_expires_at', { mode: 'date' }),
		blockedReason: text('blocked_reason'),
		version: integer('version').default(1).notNull(),
		pattern: text('pattern').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
		slot: varchar('slot', { length: 255 }).notNull().unique()
	},
	(table) => ({
		uniqueSlotWindow: uniqueIndex('unique_field_timeslot_window').on(
			table.drawSessionId,
			table.fieldId,
			table.pattern,
			table.startTime,
			table.endTime,
			table.slot,
			table.weekday
		)
	})
).enableRLS();

export const timeSlotRelations = relations(timeSlots, ({ one }) => ({
	drawSession: one(drawSessions, {
		fields: [timeSlots.drawSessionId],
		references: [drawSessions.id]
	}),
	field: one(fields, {
		fields: [timeSlots.fieldId],
		references: [fields.id]
	}),

	heldByUser: one(authUsers, {
		fields: [timeSlots.heldByUserId],
		references: [authUsers.id]
	})
}));

export const drawSessions = pgTable('draw_sessions', {
	id: uuid('id').primaryKey().defaultRandom(),
	organizationId: uuid('organization_id')
		.references(() => organizations.id, { onDelete: 'cascade' })
		.notNull(),
	name: varchar('name', { length: 255 }).notNull(),
	status: drawSessionStatusEnum('status').default('scheduled').notNull(),
	turnStrategy: turnStrategyEnum('turn_strategy').default('fixed').notNull(),
	rounds: integer('rounds'), // null => until no slots remain
	pickTimeoutSec: integer('pick_timeout_sec').default(60).notNull(),
	startsAtUtc: timestamp('starts_at_utc').notNull(),
	startDate: date('start_date', { mode: 'date' }).notNull(),
	endDate: date('end_date', { mode: 'date' }).notNull(),
	createdByUserId: uuid('created_by_user_id').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
}).enableRLS();
// =====================
// Field Draw — Core Tables (part 3)
// =====================
export const participants = pgTable('participants', {
	id: uuid('id').primaryKey().defaultRandom(),
	drawSessionId: uuid('draw_session_id')
		.references(() => drawSessions.id, { onDelete: 'cascade' })
		.notNull(),
	userId: uuid('user_id').references(() => authUsers.id, { onDelete: 'set null' }),
	email: varchar('email', { length: 255 }),
	position: integer('position').notNull(),
	role: varchar('role', { length: 32 }).default('participant').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
}).enableRLS();

export const participantsRelations = relations(participants, ({ one }) => ({
	drawSession: one(drawSessions, {
		fields: [participants.drawSessionId],
		references: [drawSessions.id]
	}),
	user: one(authUsers, {
		fields: [participants.userId],
		references: [authUsers.id]
	})
}));
export const picks = pgTable(
	'picks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		drawSessionId: uuid('draw_session_id')
			.references(() => drawSessions.id, { onDelete: 'cascade' })
			.notNull(),
		participantId: uuid('participant_id')
			.references(() => participants.id, { onDelete: 'cascade' })
			.notNull(),
		timeSlotId: uuid('time_slot_id')
			.references(() => timeSlots.id, { onDelete: 'restrict' })
			.notNull(),
		roundNumber: integer('round_number').notNull(),
		turnNumber: integer('turn_number').notNull(),
		pickedAtUtc: timestamp('picked_at_utc').defaultNow().notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => ({
		turnIdx: uniqueIndex('unique_turn').on(table.drawSessionId, table.roundNumber, table.turnNumber)
	})
).enableRLS();

export const drawSchedules = pgTable('draw_schedules', {
	id: uuid('id').primaryKey().defaultRandom(),
	drawSessionId: uuid('draw_session_id')
		.references(() => drawSessions.id, { onDelete: 'cascade' })
		.notNull(),
	recurrence: json('recurrence').notNull(), // RecurrenceMulti as JSON
	timezone: varchar('timezone', { length: 64 }).default('UTC').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull()
}).enableRLS();

export const drawScheduleFields = pgTable(
	'draw_schedule_fields',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		drawScheduleId: uuid('draw_schedule_id')
			.references(() => drawSchedules.id, { onDelete: 'cascade' })
			.notNull(),
		fieldId: uuid('field_id')
			.references(() => fields.id, { onDelete: 'cascade' })
			.notNull(),

		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => ({
		uniqueScheduleField: uniqueIndex('unique_draw_schedule_field').on(
			table.drawScheduleId,
			table.fieldId
		)
	})
).enableRLS();

export const drawScheduleRules = pgTable('draw_schedule_rules', {
	id: uuid('id').primaryKey().defaultRandom(),
	drawScheduleId: uuid('draw_schedule_id')
		.references(() => drawSchedules.id, { onDelete: 'cascade' })
		.notNull(),
	rruleString: text('rrule_string').notNull(),
	durationMinutes: integer('duration_minutes').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull()
}).enableRLS();

export const auditLogs = pgTable('audit_logs', {
	id: uuid('id').primaryKey().defaultRandom(),
	organizationId: uuid('organization_id')
		.references(() => organizations.id, { onDelete: 'cascade' })
		.notNull(),
	actorUserId: uuid('actor_user_id'),
	action: varchar('action', { length: 64 }).notNull(),
	entityType: varchar('entity_type', { length: 64 }).notNull(),
	entityId: uuid('entity_id').notNull(),
	diff: text('diff'), // JSON-encoded diff
	createdAt: timestamp('created_at').defaultNow().notNull()
}).enableRLS();

export const drawSessionsRelations = relations(drawSessions, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [drawSessions.organizationId],
		references: [organizations.id]
	}),
	timeSlots: many(timeSlots),
	participants: many(participants),
	picks: many(picks),
	schedules: many(drawSchedules)
}));
export const timeSlotsRelations = relations(timeSlots, ({ one }) => ({
	drawSession: one(drawSessions, {
		fields: [timeSlots.drawSessionId],
		references: [drawSessions.id]
	}),
	field: one(fields, {
		fields: [timeSlots.fieldId],
		references: [fields.id]
	}),
	heldByUser: one(participants, {
		fields: [timeSlots.heldByUserId],
		references: [participants.id]
	})
}));
export const sessionSchedulesRelations = relations(drawSchedules, ({ one, many }) => ({
	drawSession: one(drawSessions, {
		fields: [drawSchedules.drawSessionId],
		references: [drawSessions.id]
	}),
	fields: many(drawScheduleFields),
	rules: many(drawScheduleRules)
}));
export const scheduleFieldsRelations = relations(drawScheduleFields, ({ one }) => ({
	drawSchedule: one(drawSchedules, {
		fields: [drawScheduleFields.drawScheduleId],
		references: [drawSchedules.id]
	})
}));
export const drawScheduleFieldsFieldsRelations = relations(drawScheduleFields, ({ one }) => ({
	field: one(fields, {
		fields: [drawScheduleFields.fieldId],
		references: [fields.id]
	})
}));
export const scheduleRulesRelations = relations(drawScheduleRules, ({ one }) => ({
	drawSchedule: one(drawSchedules, {
		fields: [drawScheduleRules.drawScheduleId],
		references: [drawSchedules.id]
	})
}));
