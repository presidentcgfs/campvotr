import { pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { profiles } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

/**
 * ProfileService
 * - Manages user profiles that use authUser.id as primary key
 * - Handles profile creation and updates when users sign in
 * - Extracts user information from Supabase auth user object
 */

export const profileServiceKey = pbjKey<ProfileService>('ProfileService');

export class ProfileService extends BaseService {
	/**
	 * Retrieve a profile by user ID.
	 * Returns the profile or undefined if no profile exists.
	 */
	async fetchProfile(userId: string) {
		const [profile] = await this.db
			.select()
			.from(profiles)
			.where(eq(profiles.id, userId))
			.limit(1);
		return profile;
	}

	/**
	 * Create or update a profile when a user signs in.
	 * Uses the authUser.id as the primary key and extracts name from user metadata or email.
	 */
	async upsertProfile(user: User): Promise<void> {
		if (!user.id || !user.email) {
			throw new Error('User must have id and email');
		}

		// Extract name from user metadata or derive from email
		const userMetadata = user.user_metadata || {};
		const name = 
			userMetadata.display_name || 
			userMetadata.displayName || 
			userMetadata.full_name || 
			userMetadata.name ||
			user.email.split('@')[0]; // fallback to email prefix

		// Extract avatar URL from user metadata
		const avatarUrl = 
			userMetadata.avatar_url || 
			userMetadata.picture || 
			null;

		await this.db
			.insert(profiles)
			.values({
				id: user.id,
				name,
				email: user.email,
				avatarUrl,
				createdAt: new Date(),
				updatedAt: new Date()
			})
			.onConflictDoUpdate({
				target: profiles.id,
				set: {
					name,
					email: user.email,
					avatarUrl,
					updatedAt: new Date()
				}
			});
	}

	/**
	 * Update a profile's name.
	 */
	async updateProfileName(userId: string, name: string): Promise<void> {
		await this.db
			.update(profiles)
			.set({
				name,
				updatedAt: new Date()
			})
			.where(eq(profiles.id, userId));
	}

	/**
	 * Update a profile's avatar URL.
	 */
	async updateProfileAvatar(userId: string, avatarUrl: string | null): Promise<void> {
		await this.db
			.update(profiles)
			.set({
				avatarUrl,
				updatedAt: new Date()
			})
			.where(eq(profiles.id, userId));
	}

	/**
	 * Delete a profile.
	 */
	async deleteProfile(userId: string): Promise<void> {
		await this.db
			.delete(profiles)
			.where(eq(profiles.id, userId));
	}
}
