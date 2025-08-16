import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { supabaseAdmin } from '$lib/services/auth';
import { parseResponse } from '$lib/utils/parse';

const nameSchema = z
	.string()
	.trim()
	.min(1, 'Name must be between 1 and 100 characters.')
	.max(100, 'Name must be between 1 and 100 characters.')
	.refine((v) => /^[A-Za-z0-9 .\-']+$/.test(v), {
		message: 'Name contains invalid characters.'
	});

export const GET: RequestHandler = async (event) =>
	withAuth(event, async (_evt, user) => {
		return json({
			id: user.id,
			email: user.email,
			name: user.user_metadata?.name ?? null,
			avatar_url: user.user_metadata?.avatar_url ?? null
		});
	});

const updateUserSchema = z.object({
	name: nameSchema
});

export const PATCH: RequestHandler = async (event) =>
	withAuth(event, async (_evt, user) => {
		const parsed = await parseResponse(updateUserSchema, event.request);
		// Update Supabase auth user metadata with the new name
		const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
			user_metadata: { ...(user.user_metadata || {}), ...parsed }
		});
		if (error) return json({ error: 'Failed to update name' }, { status: 500 });
		return json({
			id: data.user?.id,
			email: data.user?.email,
			name: data.user?.user_metadata?.name
		});
	});
