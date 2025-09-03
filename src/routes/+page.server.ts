import type { PageServerLoad } from './$types';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';

export const load: PageServerLoad = async ({ locals: { user, organizationContext, resolve } }) => {
	let activeDrawSessions: any[] = [];
	
	// Only load active draws if user is logged in and has an organization context
	if (user && organizationContext?.organization?.id) {
		try {
			const drawSessionService = resolve(drawSessionServiceKey);
			const userSessions = await drawSessionService.getUserSessions(
				organizationContext.organization.id,
				user.id,
				user.email!
			);
			
			// Filter for only active sessions
			activeDrawSessions = userSessions.filter(session => session.status === 'active');
		} catch (error) {
			console.error('Error loading active draw sessions:', error);
			// Don't fail the page load if draw sessions can't be loaded
			activeDrawSessions = [];
		}
	}

	return {
		activeDrawSessions
	};
};
