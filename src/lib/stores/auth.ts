import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { AuthService } from '../auth';
import { browser } from '$app/environment';

export const user = writable<User | undefined>(undefined);
export const session = writable<Session | undefined>(undefined);
export const loading = writable(true);

// Initialize auth state
if (browser) {
	// Use getCurrentUser() for secure authentication verification
	AuthService.getCurrentUser().then((currentUser) => {
		user.set(currentUser ?? undefined);
		// Only get session if we have a valid user
		if (currentUser) {
			AuthService.getSession().then((currentSession) => {
				session.set(currentSession ?? undefined);
			});
		} else {
			session.set(undefined);
		}
		loading.set(false);
	});

	// Listen for auth changes
	AuthService.onAuthStateChange((currentUser) => {
		user.set(currentUser ?? undefined);
		// Only get session if we have a valid user
		if (currentUser) {
			AuthService.getSession().then((currentSession) => {
				session.set(currentSession ?? undefined);
			});
		} else {
			session.set(undefined);
		}
		loading.set(false);
	});
}
