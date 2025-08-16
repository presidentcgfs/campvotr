import type { RequestEvent } from '@sveltejs/kit';
import { pbj, pbjKey } from '@pbinj/pbj';
import { ballotServiceKey } from '$lib/services/ballot-service';

export const authorizationServiceKey = pbjKey<AuthorizationService>('authorizationService');
export type ActorRole = 'user' | 'admin' | 'owner';
export class AuthorizationService {
	constructor(private ballotService = pbj(ballotServiceKey)) {}

	async retrieveActorRole(event: RequestEvent): Promise<ActorRole> {
		// Using Supabase user metadata to determine role
		const user = (event as any).locals?.user;
		const role = user?.app_metadata?.role || user?.user_metadata?.role;
		if (role === 'owner') return 'owner';
		if (role === 'admin') return 'admin';
		return 'user';
	}

	async verifyBallotAdminAccess(event: RequestEvent, ballotId: string, userId: string) {
		const role = await this.retrieveActorRole(event);
		if (role === 'admin' || role === 'owner') return role;

		// Also allow ballot creator
		const ballot = await this.ballotService.getBallot(ballotId, userId);
		if (ballot && ballot.creator_id === userId) return 'owner';

		return null;
	}
}
