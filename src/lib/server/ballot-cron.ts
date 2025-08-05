import { db, ballots, notifications } from '$lib/db';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { BallotService } from '$lib/db/queries';
import { EmailService } from '$lib/server/email';

export type BallotRow = typeof ballots.$inferSelect;

export interface CronConfig {
	openReminderMinutes: number; // default 15
	closeReminderMinutes: number; // default 15
	batchSize: number; // default 50
	dryRun: boolean; // default false
	maxIterations?: number; // safety cap (default 10)
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

async function fetchRecipients(ballotId: string): Promise<Recipient[]> {
	const voters = await BallotService.getBallotVoters(ballotId);
	return voters
		.filter((v) => !!v.email)
		.map((v) => ({ keyUserId: v.user_id ?? v.id, email: v.email, name: v.name }));
}

async function alreadySentMap(
	userIds: string[],
	ballotId: string,
	key: string,
	type: 'voting_reminder' | 'voting_opened' | 'voting_closed'
) {
	if (userIds.length === 0) return new Set<string>();
	const rows = await db
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

export interface CronRunResult {
	nowIso: string;
	opened: string[];
	closed: string[];
	openReminders: { ballotId: string; count: number }[];
	closeReminders: { ballotId: string; count: number }[];
	skipped: number;
	errors: number;
}

export class BallotCron {
	static async tick(config: CronConfig): Promise<CronRunResult> {
		const now = new Date();
		const maxIterations = config.maxIterations ?? 10;
		const opened: string[] = [];
		const closed: string[] = [];
		const openReminders: { ballotId: string; count: number }[] = [];
		const closeReminders: { ballotId: string; count: number }[] = [];
		let skipped = 0;
		let errors = 0;

		// 1) Open reminders (any status)
		try {
			await this.iterateBatches(maxIterations, async () => {
				const windowEnd = new Date(now.getTime() + config.openReminderMinutes * 60_000);
				const toRemind = await db
					.select()
					.from(ballots)
					.where(and(gte(ballots.voting_opens_at, now), lte(ballots.voting_opens_at, windowEnd)))
					.orderBy(asc(ballots.voting_opens_at))
					.limit(config.batchSize);
				if (toRemind.length === 0) return false;

				for (const b of toRemind) {
					const key = buildIdempKey(b.id, 'open-reminder', new Date(b.voting_opens_at));
					const recipients = await fetchRecipients(b.id);
					const userIds = recipients.map((r) => r.keyUserId);
					const sent = await alreadySentMap(userIds, b.id, key, 'voting_reminder');
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
						if (!config.dryRun) {
							try {
								const ok = await EmailService.sendBallotReminderEmail({
									type: 'open',
									ballotId: b.id,
									ballotTitle: b.title,
									voterEmail: r.email,
									voterName: r.name ?? undefined,
									when: new Date(b.voting_opens_at),
									minutes
								});
								if (ok) {
									await db.insert(notifications).values({
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
				return toRemind.length === config.batchSize; // continue if full batch
			});
		} catch (e) {
			console.error('Error in open reminder phase', e);
			errors++;
		}

		// 2) Close reminders (only open ballots)
		try {
			await this.iterateBatches(maxIterations, async () => {
				const windowEnd = new Date(now.getTime() + config.closeReminderMinutes * 60_000);
				const toRemind = await db
					.select()
					.from(ballots)
					.where(
						and(
							eq(ballots.status, 'open'),
							gte(ballots.voting_closes_at, now),
							lte(ballots.voting_closes_at, windowEnd)
						)
					)
					.orderBy(asc(ballots.voting_closes_at))
					.limit(config.batchSize);
				if (toRemind.length === 0) return false;

				for (const b of toRemind) {
					const key = buildIdempKey(b.id, 'close-reminder', new Date(b.voting_closes_at));
					const recipients = await fetchRecipients(b.id);
					const userIds = recipients.map((r) => r.keyUserId);
					const sent = await alreadySentMap(userIds, b.id, key, 'voting_reminder');
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
						if (!config.dryRun) {
							try {
								const ok = await EmailService.sendBallotReminderEmail({
									type: 'close',
									ballotId: b.id,
									ballotTitle: b.title,
									voterEmail: r.email,
									voterName: r.name ?? undefined,
									when: new Date(b.voting_closes_at),
									minutes
								});
								if (ok) {
									await db.insert(notifications).values({
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
				return toRemind.length === config.batchSize;
			});
		} catch (e) {
			console.error('Error in close reminder phase', e);
			errors++;
		}

		// 3) Open transitions
		try {
			await this.iterateBatches(maxIterations, async () => {
				const toOpen = await db
					.select()
					.from(ballots)
					.where(and(eq(ballots.status, 'draft'), lte(ballots.voting_opens_at, now)))
					.orderBy(asc(ballots.voting_opens_at))
					.limit(config.batchSize);
				if (toOpen.length === 0) return false;

				for (const b of toOpen) {
					let transitioned = false;
					if (!config.dryRun) {
						const [updated] = await db
							.update(ballots)
							.set({ status: 'open' })
							.where(and(eq(ballots.id, b.id), eq(ballots.status, 'draft')))
							.returning();
						transitioned = !!updated;
					}
					if (config.dryRun || transitioned) {
						opened.push(b.id);
						// notify voters (email + in-app for registered users)
						const key = buildIdempKey(b.id, 'opened', new Date(b.voting_opens_at));
						const recipients = await fetchRecipients(b.id);
						const userIds = recipients.map((r) => r.keyUserId);
						const sent = await alreadySentMap(userIds, b.id, key, 'voting_opened');
						for (const r of recipients) {
							if (sent.has(r.keyUserId)) {
								skipped++;
								continue;
							}
							if (!config.dryRun) {
								try {
									const ok = await EmailService.sendBallotOpenedEmail({
										ballotId: b.id,
										ballotTitle: b.title,
										voterEmail: r.email,
										voterName: r.name ?? undefined,
										closesAt: new Date(b.voting_closes_at)
									});
									if (ok) {
										await db.insert(notifications).values({
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
				return toOpen.length === config.batchSize;
			});
		} catch (e) {
			console.error('Error in open transition phase', e);
			errors++;
		}

		// 4) Close transitions
		try {
			await this.iterateBatches(maxIterations, async () => {
				const toClose = await db
					.select()
					.from(ballots)
					.where(and(eq(ballots.status, 'open'), lte(ballots.voting_closes_at, now)))
					.orderBy(asc(ballots.voting_closes_at))
					.limit(config.batchSize);
				if (toClose.length === 0) return false;

				for (const b of toClose) {
					let transitioned = false;
					if (!config.dryRun) {
						const [updated] = await db
							.update(ballots)
							.set({ status: 'closed' })
							.where(and(eq(ballots.id, b.id), eq(ballots.status, 'open')))
							.returning();
						transitioned = !!updated;
					}
					if (config.dryRun || transitioned) {
						closed.push(b.id);
						const key = buildIdempKey(b.id, 'closed', new Date(b.voting_closes_at));
						const recipients = await fetchRecipients(b.id);
						const userIds = recipients.map((r) => r.keyUserId);
						const sent = await alreadySentMap(userIds, b.id, key, 'voting_closed');
						for (const r of recipients) {
							if (sent.has(r.keyUserId)) {
								skipped++;
								continue;
							}
							if (!config.dryRun) {
								try {
									const ok = await EmailService.sendBallotClosedEmail({
										ballotId: b.id,
										ballotTitle: b.title,
										voterEmail: r.email,
										voterName: r.name ?? undefined
									});
									if (ok) {
										await db.insert(notifications).values({
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
				return toClose.length === config.batchSize;
			});
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

	private static async iterateBatches(maxIterations: number, fn: () => Promise<boolean | void>) {
		for (let i = 0; i < maxIterations; i++) {
			const cont = await fn();
			if (!cont) break;
		}
	}
}
