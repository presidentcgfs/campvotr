import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { ballotCronKey } from '$lib/services/ballot-cron';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request, locals }) => {
	const secret = request.headers.get('x-cron-secret');
	const cronSecret = env.CRON_SECRET;
	if (!cronSecret || !secret || secret !== cronSecret) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const result = await locals.resolve(ballotCronKey).tick();
	console.log('cron result', result);
	return json({ ok: true, ...result });
};

export const GET: RequestHandler = async () => {
	return json({ error: 'Method Not Allowed' }, { status: 405 });
};
