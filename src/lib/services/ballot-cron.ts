import { ballots, notifications } from '$lib/db';
import { and, asc, between, eq, gte, inArray, lte } from 'drizzle-orm';
import { batchToGenerator } from './batch';
import { drizzleKey } from '$lib/pbj';
import { pbj, pbjKey } from '@pbinj/pbj';
import { ballotServiceKey } from '$lib/services/ballot-service';
import { emailServiceKey } from './email';
import { env } from '@pbinj/pbj/env';

export type BallotRow = typeof ballots.$inferSelect;

export interface CronConfig {
	openReminderMinutes: number; // default 15
	closeReminderMinutes: number; // default 15
	batchSize: number; // default 50
	dryRun: boolean; // default false
}

interface Recipient {
	keyUserId: string; // user_id if present, else voter.id
	email: string;
	name?: string | null;
}

function buildIdempKey(
	ballotId: string,
	eventType: 'open-reminder' | 'close-reminder' | 'opened' | 'closed',
	ts: Date
) {
	return `ballot:${ballotId}:${eventType}:${ts.toISOString()}`;
}

function keyPrefix(key: string) {
	return `[key:${key}]`;
}

function withKeyMessage(key: string, message: string) {
	return `${keyPrefix(key)} ${message}`;
}

export interface CronRunResult {
	nowIso: string;
	opened: string[];
	closed: string[];
	openReminders: { ballotId: string; count: number }[];
	closeReminders: { ballotId: string; count: number }[];
	skipped: number;
	errors: number;
}

class CronConfigObj {
	constructor(
		private _openReminderMinutes = env('OPEN_REMINDER_MINUTES', '15'),
		private _closeReminderMinutes = env('CLOSE_REMINDER_MINUTES', '15'),
		private _batchSize = env('BATCH_SIZE', '50'),
		private _dryRun = env('DRY_RUN', 'false')
	) {}
	get openReminderMinutes() {
		return Number(this._openReminderMinutes);
	}
	get closeReminderMinutes() {
		return Number(this._closeReminderMinutes);
	}
	get batchSize() {
		return Number(this._batchSize);
	}
	get dryRun() {
		return this._dryRun === 'true';
	}
}

export const ballotCronKey = pbjKey<BallotCron>('ballotCron');
export class BallotCron {
	constructor(
		private config = pbj(CronConfigObj),
		private db = pbj(drizzleKey),
		private ballotService = pbj(ballotServiceKey),
		private emailService = pbj(emailServiceKey)
	) {}

	async fetchRecipients(ballotId: string): Promise<Recipient[]> {
		const voters = await this.ballotService.getBallotVoters(ballotId);
		return voters
			.filter((v) => !!v.email)
			.map((v) => ({ keyUserId: v.user_id ?? v.id, email: v.email, name: v.name }));
	}

	async alreadySentMap(
		userIds: string[],
		ballotId: string,
		key: string,
		type: 'voting_reminder' | 'voting_opened' | 'voting_closed'
	) {
		if (userIds.length === 0) return new Set<string>();
		const rows = await this.db
			.select({ user_id: notifications.user_id, message: notifications.message })
			.from(notifications)
			.where(
				and(
					eq(notifications.ballot_id, ballotId),
					eq(notifications.type, type),
					inArray(notifications.user_id, userIds)
				)
			);
		const pref = keyPrefix(key);
		const sent = new Set<string>();
		for (const r of rows) {
			if (r.message?.startsWith(pref)) sent.add(r.user_id);
		}
		return sent;
	}
	async tick(): Promise<CronRunResult> {
		const now = new Date();
		const opened: string[] = [];
		const closed: string[] = [];
		const openReminders: { ballotId: string; count: number }[] = [];
		const closeReminders: { ballotId: string; count: number }[] = [];
		let skipped = 0;
		let errors = 0;

		// 1) Open reminders (any status)
		try {
			for await (const b of batchToGenerator((offset, limit) => {
				return this.db
					.select()
					.from(ballots)
					.where(and(gte(ballots.voting_opens_at, now), lte(ballots.voting_closes_at, now)))
					.orderBy(asc(ballots.voting_opens_at))
					.offset(offset)
					.limit(limit);
			}, this.config.batchSize)) {
				const key = buildIdempKey(b.id, 'open-reminder', new Date(b.voting_opens_at));
				const recipients = await this.fetchRecipients(b.id);
				const userIds = recipients.map((r) => r.keyUserId);
				const sent = await this.alreadySentMap(userIds, b.id, key, 'voting_reminder');
				let count = 0;
				for (const r of recipients) {
					if (sent.has(r.keyUserId)) {
						skipped++;
						continue;
					}
					const minutes = Math.max(
						1,
						Math.ceil((new Date(b.voting_opens_at).getTime() - now.getTime()) / 60_000)
					);
					const message = `Ballot opens in ${minutes} minute${minutes === 1 ? '' : 's'}`;
					const withKey = withKeyMessage(key, message);
					if (!this.config.dryRun) {
						try {
							const ok = await this.emailService.sendBallotReminderEmail({
								type: 'open',
								ballotId: b.id,
								ballotTitle: b.title,
								voterEmail: r.email,
								voterName: r.name ?? undefined,
								when: new Date(b.voting_opens_at),
								minutes
							});
							if (ok) {
								await this.db.insert(notifications).values({
									user_id: r.keyUserId,
									ballot_id: b.id,
									type: 'voting_reminder',
									message: withKey
								});
								count++;
							}
						} catch (e) {
							console.error('open-reminder email failed', { ballotId: b.id });
							errors++;
						}
					} else {
						count++;
					}
				}
				openReminders.push({ ballotId: b.id, count });
			}
		} catch (e) {
			console.error('Error in open reminder phase', e);
			errors++;
		}

		// 2) Close reminders (only open ballots)
		try {
			const windowEnd = new Date(now.getTime() + this.config.closeReminderMinutes * 60_000);

			for await (const b of batchToGenerator((offset, limit) => {
				return this.db
					.select()
					.from(ballots)
					.where(and(eq(ballots.status, 'open'), between(ballots.voting_closes_at, now, windowEnd)))
					.orderBy(asc(ballots.voting_closes_at))
					.offset(offset)
					.limit(limit);
			}, this.config.batchSize)) {
				const key = buildIdempKey(b.id, 'close-reminder', new Date(b.voting_closes_at));
				const recipients = await this.fetchRecipients(b.id);
				const userIds = recipients.map((r) => r.keyUserId);
				const sent = await this.alreadySentMap(userIds, b.id, key, 'voting_reminder');
				let count = 0;
				for (const r of recipients) {
					if (sent.has(r.keyUserId)) {
						skipped++;
						continue;
					}
					const minutes = Math.max(
						1,
						Math.ceil((new Date(b.voting_closes_at).getTime() - now.getTime()) / 60_000)
					);
					const message = `Ballot closes in ${minutes} minute${minutes === 1 ? '' : 's'}`;
					const withKey = withKeyMessage(key, message);
					if (!this.config.dryRun) {
						try {
							const ok = await this.emailService.sendBallotReminderEmail({
								type: 'close',
								ballotId: b.id,
								ballotTitle: b.title,
								voterEmail: r.email,
								voterName: r.name ?? undefined,
								when: new Date(b.voting_closes_at),
								minutes
							});
							if (ok) {
								await this.db.insert(notifications).values({
									user_id: r.keyUserId,
									ballot_id: b.id,
									type: 'voting_reminder',
									message: withKey
								});
								count++;
							}
						} catch (e) {
							console.error('close-reminder email failed', { ballotId: b.id });
							errors++;
						}
					} else {
						count++;
					}
				}
				closeReminders.push({ ballotId: b.id, count });
			}
		} catch (e) {
			console.error('Error in close reminder phase', e);
			errors++;
		}

		// 3) Open transitions
		try {
			for await (const b of batchToGenerator((offset, limit) => {
				return this.db
					.select()
					.from(ballots)
					.where(and(eq(ballots.status, 'draft'), lte(ballots.voting_opens_at, now)))
					.orderBy(asc(ballots.voting_opens_at))
					.offset(offset)
					.limit(limit);
			}, this.config.batchSize)) {
				let transitioned = false;
				if (!this.config.dryRun) {
					const [updated] = await this.db
						.update(ballots)
						.set({ status: 'open' })
						.where(and(eq(ballots.id, b.id), eq(ballots.status, 'draft')))
						.returning();
					transitioned = !!updated;
				}
				if (this.config.dryRun || transitioned) {
					opened.push(b.id);
					// notify voters (email + in-app for registered users)
					const key = buildIdempKey(b.id, 'opened', new Date(b.voting_opens_at));
					const recipients = await this.fetchRecipients(b.id);
					const userIds = recipients.map((r) => r.keyUserId);
					const sent = await this.alreadySentMap(userIds, b.id, key, 'voting_opened');
					for (const r of recipients) {
						if (sent.has(r.keyUserId)) {
							skipped++;
							continue;
						}
						if (!this.config.dryRun) {
							try {
								const ok = await this.emailService.sendBallotOpenedEmail({
									ballotId: b.id,
									ballotTitle: b.title,
									voterEmail: r.email,
									voterName: r.name ?? undefined,
									closesAt: new Date(b.voting_closes_at)
								});
								if (ok) {
									await this.db.insert(notifications).values({
										user_id: r.keyUserId,
										ballot_id: b.id,
										type: 'voting_opened',
										message: withKeyMessage(key, 'Voting is now open')
									});
								}
							} catch (e) {
								console.error('opened email failed', { ballotId: b.id });
								errors++;
							}
						}
					}
				}
			}
		} catch (e) {
			console.error('Error in open transition phase', e);
			errors++;
		}

		// 4) Close transitions
		try {
			for await (const b of batchToGenerator((offset, limit) => {
				return this.db
					.select()
					.from(ballots)
					.where(and(eq(ballots.status, 'open'), lte(ballots.voting_closes_at, now)))
					.orderBy(asc(ballots.voting_closes_at))
					.offset(offset)
					.limit(limit);
			}, this.config.batchSize)) {
				let transitioned = false;
				if (!this.config.dryRun) {
					const [updated] = await this.db
						.update(ballots)
						.set({ status: 'closed' })
						.where(and(eq(ballots.id, b.id), eq(ballots.status, 'open')))
						.returning();
					transitioned = !!updated;
				}
				if (this.config.dryRun || transitioned) {
					closed.push(b.id);
					const key = buildIdempKey(b.id, 'closed', new Date(b.voting_closes_at));
					const recipients = await this.fetchRecipients(b.id);
					const userIds = recipients.map((r) => r.keyUserId);
					const sent = await this.alreadySentMap(userIds, b.id, key, 'voting_closed');
					for (const r of recipients) {
						if (sent.has(r.keyUserId)) {
							skipped++;
							continue;
						}
						if (!this.config.dryRun) {
							try {
								const ok = await this.emailService.sendBallotClosedEmail({
									ballotId: b.id,
									ballotTitle: b.title,
									voterEmail: r.email,
									voterName: r.name ?? undefined
								});
								if (ok) {
									await this.db.insert(notifications).values({
										user_id: r.keyUserId,
										ballot_id: b.id,
										type: 'voting_closed',
										message: withKeyMessage(key, 'Voting is now closed')
									});
								}
							} catch (e) {
								console.error('closed email failed', { ballotId: b.id });
								errors++;
							}
						}
					}
				}
			}
		} catch (e) {
			console.error('Error in close transition phase', e);
			errors++;
		}

		return {
			nowIso: now.toISOString(),
			opened,
			closed,
			openReminders,
			closeReminders,
			skipped,
			errors
		};
	}
}
