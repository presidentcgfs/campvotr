import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/services/middleware';
import { voterServiceKey } from '$lib/services/voter-service';

const createVoterSchema = z.object({
	email: z.string().email('Invalid email'),
	name: z.string().optional()
});

const linkVoterSchema = z.object({
	email: z.string().email('Invalid email')
});

// GET /api/voters - Search voters by email or name
export const GET: RequestHandler = (event) =>
	withAuth(event, async ({ url, locals }, user) => {
		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		const searchQuery = url.searchParams.get('search');
		const limit = parseInt(url.searchParams.get('limit') || '50');
		const voterSvc = locals.resolve(voterServiceKey);
		const voters = await voterSvc.search({ query: searchQuery, limit });
		return json({ voters });
	});

// POST /api/voters - Create a new voter or link existing voter to user
export const POST: RequestHandler = (event) =>
	withAuth(event, async ({ request, locals }, user) => {
		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		const body = await request.json();
		const action = body.action; // 'create' or 'link'
		const voterSvc = locals.resolve(voterServiceKey);
		if (action === 'link') {
			const validatedData = linkVoterSchema.parse(body);
			const result = await voterSvc.linkToUserByEmail(validatedData.email, user.id);
			if ('error' in result) {
				if (result.error === 'not_found')
					return json({ error: 'Voter not found' }, { status: 404 });
				if (result.error === 'already_linked')
					return json({ error: 'Voter already linked to a user' }, { status: 400 });
			}
			return json({ voter: result.voter });
		} else {
			const validatedData = createVoterSchema.parse(body);
			const result = await voterSvc.create(validatedData.email, validatedData.name);
			if ('error' in result && result.error === 'exists')
				return json({ error: 'Voter with this email already exists' }, { status: 400 });
			return json({ voter: result.voter }, { status: 201 });
		}
	});
