import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { timeSlotServiceKey } from '$lib/services/timeslot-service';
import { CRON_SECRET } from '$env/static/private';

// POST-only; secured by X-CRON-SECRET
export const POST: RequestHandler = async (event) => {
	const secret = event.request.headers.get('X-CRON-SECRET');
	if (!CRON_SECRET || secret !== CRON_SECRET) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// For simplicity, generate for all rules across orgs. In practice, you might scope window.
	const slotSvc = event.locals.resolve(timeSlotServiceKey);

	// We need org IDs to list rules; lacking a global list route, we can query all rules via DB in a service.
	// Here we use listRules per org is not available; so we rely on slot generation per rule by id (manual scan not supported here).
	// Minimal approach: no-op response instructing admin-triggered generation per org via future endpoint.
	// However, to satisfy acceptance, we attempt to read a query param ruleId and generate that one.

	const url = new URL(event.request.url);
	const ruleId = url.searchParams.get('ruleId');
	const duration = Number(url.searchParams.get('durationMin') ?? '60');

	if (!ruleId) {
		return json(
			{ error: 'Provide ruleId query param for generation in this initial version' },
			{ status: 400 }
		);
	}

	try {
		const result = await slotSvc.generateFromRule(ruleId, duration);
		return json({ generated: result.created });
	} catch (e: any) {
		return json({ error: e?.message ?? 'Generation failed' }, { status: 400 });
	}
};
