import { writable } from 'svelte/store';
import type { User, Session } from '@supabase/supabase-js';
import { AuthService } from '../auth';
import { browser } from '$app/environment';

export const user = writable<User | null>(null);
export const session = writable<Session | null>(null);
export const loading = writable(true);

// Initialize auth state
if (browser) {
	AuthService.getSession().then((currentSession) => {
		user.set(currentSession?.user ?? null);
		session.set(currentSession);
		loading.set(false);
	});

	// // Listen for auth changes
	AuthService.onAuthStateChange((currentUser) => {
		user.set(currentUser);
		// Get updated session when user changes
		AuthService.getSession().then((currentSession) => {
			session.set(currentSession);
		});
		loading.set(false);
	});
}
