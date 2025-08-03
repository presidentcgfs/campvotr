import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
	id: string;
	email: string;
	created_at: string;
}

export class AuthService {
	static async signUp(email: string, password: string) {
		const { data, error } = await supabase.auth.signUp({
			email,
			password
		});

		if (error) {
			throw new Error(error.message);
		}

		return data;
	}

	static async signIn(email: string, password: string) {
		const { data, error } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			throw new Error(error.message);
		}

		return data;
	}

	static async signOut() {
		const { error } = await supabase.auth.signOut();

		if (error) {
			throw new Error(error.message);
		}
	}

	static async getCurrentUser(): Promise<User | null> {
		const {
			data: { user }
		} = await supabase.auth.getUser();
		return user;
	}

	static async getSession() {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		return session;
	}

	static async signInWithGoogle(redirectTo?: string) {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: redirectTo ?? `${location.origin}/auth/callback`
			}
		});

		if (error) {
			throw new Error(error.message);
		}

		return data;
	}
}
