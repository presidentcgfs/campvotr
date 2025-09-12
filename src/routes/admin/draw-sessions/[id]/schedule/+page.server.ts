import type { Actions, PageServerLoad } from './$types';
import { withAuthRedirect } from '$lib/services/middleware';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { timeSlotServiceKey } from '$lib/services/timeslot-service';
import { pickServiceKey } from '$lib/services/pick-service';
import { redirect } from '@sveltejs/kit';
import { extractResponse, parseResponse } from '$lib/utils/parse';

import {
	unassignActionSchema,
	pickActionSchema,
	blockActionSchema,
	unblockActionSchema
} from '$lib/db/zod';
import { timeSlotInsertSchema } from '$lib/db/zod';

export const load: PageServerLoad = withAuthRedirect(
	async ({ params, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) {
			redirect(302, '/login');
		}

		const sessionId = params.id;
		if (!sessionId) {
			return redirect(302, '/admin/draw-sessions');
		}

		const timeSlotService = resolve(timeSlotServiceKey);

		return await timeSlotService.loadAllSlots(sessionId);
	}
);

export const actions: Actions = {
	assign: async ({ request, params, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };

		const sessionId = params.id;
		if (!sessionId) return { error: 'Missing session ID' };

		// Parse and validate form data using the imported schema
		const rest = await parseResponse(
			timeSlotInsertSchema,
			request,

			({ id, ...rest }: { id?: string }) => ({
				...rest,
				id: id?.startsWith('new:') ? undefined : id,
				drawSessionId: sessionId
			})
		);

		const timeSlotService = resolve(timeSlotServiceKey);
		const drawSessionService = resolve(drawSessionServiceKey);

		// If no roundNumber is specified, default to current round
		if (!rest.roundNumber && rest.heldByUserId) {
			try {
				const currentTurn = await drawSessionService.computeCurrentTurn(orgId, sessionId);
				rest.roundNumber = currentTurn.roundNumber;
			} catch (e) {
				// If we can't compute current turn, default to round 1
				rest.roundNumber = 1;
			}
		}

		// Now assign the slot (whether it was just created or already existed)
		const slot = await timeSlotService.assignSlot(rest);

		return { success: true, slot };
	},

	unassign: async ({ request, params, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };

		const sessionId = params.id;
		if (!sessionId) return { error: 'Missing session ID' };

		// Parse and validate form data using the imported schema
		const parseResult = await parseResponse(unassignActionSchema, request);
		if ('error' in parseResult) {
			return { error: parseResult.error };
		}

		const { pattern, fieldId } = parseResult;

		const timeSlotService = resolve(timeSlotServiceKey);

		// Use pattern-based unassignment (pattern and fieldId are required by schema)
		const slot = await timeSlotService.unassignSlotByPattern(sessionId, pattern, fieldId);

		return { success: true, slot };
	},

	pick: async ({ request, params, locals: { resolve, organizationContext, user } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };
		if (!user) return { error: 'User not authenticated' };

		const sessionId = params.id;
		if (!sessionId) return { error: 'Missing session ID' };

		// Parse and validate form data using the imported schema
		const parseResult = await parseResponse(pickActionSchema, request);
		if ('error' in parseResult) {
			return { error: parseResult.error };
		}

		const { slotId } = parseResult;

		// Use the existing performPick method which handles turn validation
		const pickService = resolve(pickServiceKey);
		try {
			const result = await pickService.performPick({
				organizationId: orgId,
				sessionId,
				userId: user.id,
				timeSlotId: slotId
			});
			return { success: true, result };
		} catch (e: any) {
			if (e?.status === 409) {
				return { error: 'Slot already picked' };
			}
			return { error: e?.message || 'Pick failed' };
		}
	},

	block: async ({ request, params, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };

		const sessionId = params.id;
		if (!sessionId) return { error: 'Missing session ID' };

		// Parse and validate form data using the imported schema
		const parseResult = await parseResponse(blockActionSchema, request);
		if ('error' in parseResult) {
			return { error: parseResult.error };
		}

		const { pattern, fieldId, reason, isSynthetic, startUtc, endUtc } = parseResult;

		const timeSlotService = resolve(timeSlotServiceKey);

		// If this is a synthetic slot, we need to create it first
		if (isSynthetic && startUtc && endUtc) {
			const createResult = await timeSlotService.bulkCreateIfValid(sessionId, [
				{ fieldId, startUtc, endUtc }
			]);

			if (createResult.error && !createResult.error.includes('overlap')) {
				console.log('Slot creation note:', createResult.error);
			}
		}

		// Block the slot
		try {
			const result = await timeSlotService.blockSlotByPattern(sessionId, pattern, fieldId, reason);
			return { success: true, result };
		} catch (e: any) {
			return { error: e.message || 'Failed to block slot' };
		}
	},

	unblock: async ({ request, params, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };

		const sessionId = params.id;
		if (!sessionId) return { error: 'Missing session ID' };

		// Parse and validate form data using the imported schema
		const parseResult = await parseResponse(unblockActionSchema, request);
		if ('error' in parseResult) {
			return { error: parseResult.error };
		}

		const { pattern, fieldId } = parseResult;

		const timeSlotService = resolve(timeSlotServiceKey);

		// Unblock the slot
		try {
			const result = await timeSlotService.unblockSlotByPattern(sessionId, pattern, fieldId);
			return { success: true, result };
		} catch (e: any) {
			return { error: e.message || 'Failed to unblock slot' };
		}
	}
};
