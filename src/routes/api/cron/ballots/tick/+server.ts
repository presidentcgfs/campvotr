import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { BallotCron } from '$lib/server/ballot-cron';
import { env } from '$env/dynamic/private';

function parseBool(val: string | undefined, def = false) {
	if (!val) return def;
	const v = val.toLowerCase();
	return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export const POST: RequestHandler = async ({ request }) => {
	const secret = request.headers.get('x-cron-secret');
	const cronSecret = env.CRON_SECRET;
	if (!cronSecret || !secret || secret !== cronSecret) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const openReminderMinutes = Number(env.OPEN_REMINDER_MINUTES ?? '15');
	const closeReminderMinutes = Number(env.CLOSE_REMINDER_MINUTES ?? '15');
	const batchSize = Number(env.BATCH_SIZE ?? '50');
	const dryRun = parseBool(env.DRY_RUN, false);
	console.log(`cron request`, { openReminderMinutes, closeReminderMinutes, batchSize, dryRun });

	const result = await BallotCron.tick({
		openReminderMinutes: Number.isFinite(openReminderMinutes) ? openReminderMinutes : 15,
		closeReminderMinutes: Number.isFinite(closeReminderMinutes) ? closeReminderMinutes : 15,
		batchSize: Number.isFinite(batchSize) ? batchSize : 50,
		dryRun
	});
	console.log('cron result', result);
	return json({ ok: true, ...result });
};

export const GET: RequestHandler = async () => {
	return json({ error: 'Method Not Allowed' }, { status: 405 });
};
