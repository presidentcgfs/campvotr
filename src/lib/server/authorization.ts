import type { RequestEvent } from '@sveltejs/kit';
import { BallotService } from '$lib/db/queries';

export type ActorRole = 'user' | 'admin' | 'owner';

export async function retrieveActorRole(event: RequestEvent): Promise<ActorRole> {
	// Using Supabase user metadata to determine role
	const user = (event as any).locals?.user;
	const role = user?.app_metadata?.role || user?.user_metadata?.role;
	if (role === 'owner') return 'owner';
	if (role === 'admin') return 'admin';
	return 'user';
}

export async function verifyBallotAdminAccess(
	event: RequestEvent,
	ballotId: string,
	userId: string
) {
	const role = await retrieveActorRole(event);
	if (role === 'admin' || role === 'owner') return role;

	// Also allow ballot creator
	const ballot = await BallotService.getBallot(ballotId, userId);
	if (ballot && ballot.creator_id === userId) return 'owner';

	return null;
}
