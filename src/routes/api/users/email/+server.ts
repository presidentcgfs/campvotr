import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { withAuth } from '$lib/services/middleware';
import { userServiceKey } from '$lib/services/user-service';
import { parseResponse } from '$lib/utils/parse';

const querySchema = z.object({
	email: z.string().email('Invalid email address')
});

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event, user) => {
		const { email } = await parseResponse(querySchema, event.request);

		// Get the current user's organization context
		const orgContext = event.locals.organizationContext;
		if (!orgContext?.organization?.id) {
			return json({ error: 'Organization context not found' }, { status: 400 });
		}

		// Use UserService to find the member by email within the organization
		const userService = event.locals.resolve(userServiceKey);
		const member = await userService.findMemberByEmail(orgContext.organization.id, email);

		if (!member) {
			return json({ error: 'User not found in organization' }, { status: 404 });
		}

		// Return the user ID and display name
		return json({
			userId: member.userId,
			displayName: member.displayName,
			email: email
		});
	});
