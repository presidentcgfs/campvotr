import { json } from '@sveltejs/kit';
import { getUser } from '$lib/services/auth';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { voterListServiceKey } from '$lib/services/voter-list';
import { idSchema } from '$lib/validation';

const updateVoterListSchema = z.object({
	name: z.string().min(1, 'Name is required').max(255, 'Name too long').optional(),
	description: z.string().optional(),
	voterEmails: z
		.transform((val: string | string[]) => {
			const r = Array.isArray(val) ? val : val.split(/\s|,|;|\n/);
			return r;
		})
		.pipe(z.array(z.email()))
		.optional()
});

// GET /api/voter-lists/[id] - Get a specific voter list with its members
export const GET: RequestHandler = async (event) => {
	try {
		const user = event.locals?.user;
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const voterListId = idSchema.parse(event.params).id;
		const svc = event.locals.resolve(voterListServiceKey);
		const voterList = await svc.fetchOwnedList(voterListId, user.id);
		if (!voterList) {
			return json({ error: 'Voter list not found' }, { status: 404 });
		}
		const voterMembers = await svc.findVoterMmebers(voterListId);
		return json({ voterList: { ...voterList, voters: voterMembers } });
	} catch (error) {
		console.error('Error fetching voter list:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

// PUT /api/voter-lists/[id] - Update a voter list
export const PUT: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	const voterListId = idSchema.parse(event.params).id;
	const validatedData = updateVoterListSchema.parse(await event.request.json());
	const svc = event.locals.resolve(voterListServiceKey);
	const existingVoterList = await svc.fetchOwnedList(voterListId, user.id);
	if (!existingVoterList) {
		return json({ error: 'Voter list not found' }, { status: 404 });
	}
	await svc.updateVoterList(voterListId, {
		name: validatedData.name,
		description: validatedData.description,
		voterEmails: validatedData.voterEmails
	});
	const updated = await svc.fetchById(voterListId);
	return json({ voterList: updated });
};

// DELETE /api/voter-lists/[id] - Delete a voter list
export const DELETE: RequestHandler = async (event) => {
	try {
		const user = (event as any).locals?.user ?? (await getUser(event));
		if (!user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
		const voterListId = event.params.id;
		const svc = event.locals.resolve(voterListServiceKey);
		const ok = await svc.deleteOwnedList(voterListId, user.id);
		if (!ok) return json({ error: 'Voter list not found' }, { status: 404 });
		return json({ message: 'Voter list deleted successfully' });
	} catch (error) {
		console.error('Error deleting voter list:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
