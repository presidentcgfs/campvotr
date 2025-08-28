import { pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { authUsers } from 'drizzle-orm/supabase';
import { and, eq } from 'drizzle-orm';
import { supabaseAdmin } from './auth';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { SupabaseClient } from '@supabase/supabase-js';
import { organizationMemberships } from '$lib/db/schema';

/**
 * UserService
 * - Encapsulates user-related read/update operations and avatar storage.
 * - Organization-scoped lookups use organizationId (not slug) and enforce membership.
 * - Supabase auth metadata keys normalized: prefers `display_name` but also reads `displayName`.
 */

export const userServiceKey = pbjKey<UserService>('userService');

/**
 * Params for uploadAvatar.
 * - userId: Supabase auth user ID
 * - file: PNG/JPG/WEBP up to 2MB
 * - supabaseClient: caller-scoped client used for storage upload
 */

export interface AvatarUploadParams {
	userId: string;
	file: File;
	supabaseClient: SupabaseClient;
}

/**
 * Params for deleteAvatar.
 * - userId: Supabase auth user ID
 * - currentAvatarUrl: optional public avatar URL to remove from storage
 * - supabaseClient: caller-scoped client used for storage delete
 */

export interface AvatarDeleteParams {
	userId: string;
	currentAvatarUrl?: string;
	supabaseClient: SupabaseClient;
}

/**
 * Service for retrieving/updating user profile and managing avatars.
 * Note: Inject via pbj DI; route handlers should remain thin (auth/validation only).
 */

export class UserService extends BaseService {
	/**
	 * Retrieve an auth user row by userId.
	 * Returns the row or undefined if no user exists.
	 */

	async fetchUser(userId: string) {
		const [user] = await this.db.select().from(authUsers).where(eq(authUsers.id, userId)).limit(1);
		return user;
	}

	// Find a member (user) of this organization by email (org-scoped)
	/**
	 * Find an organization member by email (org-scoped).
	 * - Filters by organizationId and exact email on the auth users table.
	 * - Returns `{ userId, displayName? }` or null if the email is not a member of the org.
	 * - Display name is derived from auth metadata (`display_name` or `displayName`).
	 */

	async findMemberByEmail(
		organizationId: string,
		email: string
	): Promise<{ userId: string; displayName?: string | null } | null> {
		// Join memberships -> users and filter by org + email
		// Note: Drizzle's authUsers.email typing may require a cast to satisfy eq()
		// We only need the first match

		const rows = await this.db
			.select()
			.from(organizationMemberships)
			.leftJoin(authUsers, eq(organizationMemberships.userId, authUsers.id))
			.where(
				and(
					eq(organizationMemberships.organizationId, organizationId),
					eq(authUsers.email as any, email)
				)
			)
			.limit(1);
		const r: any = rows?.[0];
		if (!r || !r.users) return null;
		const meta = r.users?.raw_user_meta_data || {};
		return { userId: r.users.id, displayName: meta.display_name ?? meta.displayName ?? null };
	}

	/**
	 * Get the user's display name from Supabase auth metadata.
	 * Returns null if unavailable or on error.
	 */

	async fetchDisplayName(userId: string): Promise<string | null> {
		const { data, error } = await supabaseAdmin.auth.admin.getUser(userId);
		if (error) return null;
		const meta: any = data.user?.user_metadata || {};
		return meta.display_name ?? meta.displayName ?? null;
	}

	/**
	 * Update the user's display name in Supabase auth metadata.
	 * Merges with existing metadata and stores under `display_name`.
	 * Throws on failure.
	 */

	async updateDisplayName(userId: string, displayName: string): Promise<void> {
		// Merge into metadata, preferring display_name
		const { data, error } = await supabaseAdmin.auth.admin.getUser(userId);
		if (error) throw new Error('Failed to fetch user');
		const existing = (data.user?.user_metadata as any) || {};
		const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
			user_metadata: { ...existing, display_name: displayName }
		});
		if (updErr) throw new Error('Failed to update profile');
	}

	/**
	 * Validates image file type and size
	 */
	validateImageFile(file: File): { valid: boolean; error?: string } {
		const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
		const maxSize = 2 * 1024 * 1024; // 2MB

		if (!allowedMimeTypes.includes(file.type)) {
			return {
				valid: false,
				error: 'Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.'
			};
		}

		if (file.size > maxSize) {
			return {
				valid: false,
				error: 'Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.'
			};
		}

		return { valid: true };
	}

	/**
	 * Gets file extension from MIME type
	 */
	private getExtensionFromMimeType(mimeType: string): string | null {
		const mimeToExt: Record<string, string> = {
			'image/png': 'png',
			'image/jpeg': 'jpg',
			'image/webp': 'webp'
		};
		return mimeToExt[mimeType] || null;
	}

	/**
	 * Uploads user avatar to Supabase storage and updates user metadata
	 */
	async uploadAvatar(params: AvatarUploadParams): Promise<{ avatarUrl: string }> {
		const { userId, file, supabaseClient } = params;

		// Validate file
		const validation = this.validateImageFile(file);
		if (!validation.valid) {
			throw new Error(validation.error);
		}

		const ext = this.getExtensionFromMimeType(file.type);
		if (!ext) {
			throw new Error('Invalid image format');
		}

		// Read file buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		if (!buffer || buffer.length === 0) {
			throw new Error('Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.');
		}

		// Upload to Supabase storage
		const bucket = 'avatars';
		const path = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;

		const { data: uploadData, error: uploadError } = await supabaseClient.storage
			.from(bucket)
			.upload(path, buffer, {
				contentType: file.type,
				upsert: true
			});

		if (uploadError) {
			throw new Error('Failed to upload image');
		}

		// Generate public URL
		const publicUrl = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${uploadData.fullPath}`;

		// Update user metadata
		const { data: userData, error: metaError } = await supabaseAdmin.auth.admin.getUser(userId);
		if (metaError) {
			throw new Error('Failed to fetch user');
		}

		const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
			user_metadata: {
				...(userData.user?.user_metadata || {}),
				avatar_url: publicUrl
			}
		});

		if (updateError) {
			throw new Error('Failed to update profile');
		}

		return { avatarUrl: publicUrl };
	}

	/**
	 * Deletes user avatar from Supabase storage and updates user metadata
	 */
	async deleteAvatar(params: AvatarDeleteParams): Promise<void> {
		const { userId, currentAvatarUrl, supabaseClient } = params;

		// Delete from storage if exists
		if (currentAvatarUrl) {
			const prefix = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
			if (currentAvatarUrl.startsWith(prefix)) {
				const fullPath = currentAvatarUrl.substring(prefix.length);
				await supabaseClient.storage.from('avatars').remove([fullPath]);
			}
		}

		// Update user metadata to remove avatar URL
		const { data: userData, error: fetchError } = await supabaseAdmin.auth.admin.getUser(userId);
		if (fetchError) {
			throw new Error('Failed to fetch user');
		}

		const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
			user_metadata: {
				...(userData.user?.user_metadata || {}),
				avatar_url: null
			}
		});

		if (updateError) {
			throw new Error('Failed to update profile');
		}
	}
}
