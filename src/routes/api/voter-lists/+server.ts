import { json } from '@sveltejs/kit';
import { getUser } from '$lib/services/auth';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { voterListServiceKey } from '$lib/services/voter-list';

const createVoterListSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
	description: z.string().optional(),
	voterEmails: z
		.transform((v: unknown) => {
			const raw = Array.isArray(v)
				? v.flatMap((e) => String(e).split(/\s|,|;|\n/))
				: String(v).split(/\s|,|;|\n/);
			return raw.filter((s) => s.trim().length > 0);
		})
		.pipe(z.email().array().min(1, 'At least one voter email is required'))
});

// GET /api/voter-lists - Get all voter lists for the authenticated user
export const GET: RequestHandler = async (event) => {
	try {
		const user = (event as any).locals?.user ?? (await getUser(event));
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const svc = event.locals.resolve(voterListServiceKey);
		const voterLists = await svc.listForUserWithCounts(user.id);
		return json({ voterLists });
	} catch (error) {
		console.error('Error fetching voter lists:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// POST /api/voter-lists - Create a new voter list
export const POST: RequestHandler = async (event) => {
	try {
		const user = (event as any).locals?.user ?? (await getUser(event));
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await event.request.json();
		const { success, data: validatedData, error: details } = createVoterListSchema.safeParse(body);
		if (success === false) {
			return json({ error: 'Validation error', details: z.flattenError(details) }, { status: 400 });
		}
		const svc = event.locals.resolve(voterListServiceKey);
		const newVoterList = await svc.createList({
			userId: user.id,
			name: validatedData.name,
			description: validatedData.description,
			voterEmails: validatedData.voterEmails
		});
		return json({ voterList: newVoterList }, { status: 201 });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json({ error: 'Validation error', details: z.flattenError(error) }, { status: 400 });
		}
		console.error('Error creating voter list:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
