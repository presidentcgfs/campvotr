import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { AuthService } from '../auth';
import { browser } from '$app/environment';

export const user = writable<User | undefined>(undefined);
export const session = writable<Session | undefined>(undefined);
export const loading = writable(true);

// Initialize auth state
if (browser) {
	AuthService.getSession().then((currentSession) => {
		user.set(currentSession?.user);
		session.set(currentSession ?? undefined);
		loading.set(false);
	});

	// // Listen for auth changes
	AuthService.onAuthStateChange((currentUser) => {
		user.set(currentUser ?? undefined);
		// Get updated session when user changes
		AuthService.getSession().then((currentSession) => {
			session.set(currentSession ?? undefined);
		});
		loading.set(false);
	});
}
