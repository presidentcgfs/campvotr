import { pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { authUsers } from 'drizzle-orm/supabase';
import { eq } from 'drizzle-orm';
import { supabaseAdmin } from './auth';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import type { SupabaseClient } from '@supabase/supabase-js';

export const userServiceKey = pbjKey<UserService>('userService');

export interface AvatarUploadParams {
	userId: string;
	file: File;
	supabaseClient: SupabaseClient;
}

export interface AvatarDeleteParams {
	userId: string;
	currentAvatarUrl?: string;
	supabaseClient: SupabaseClient;
}

export class UserService extends BaseService {
	async fetchUser(userId: string) {
		const [user] = await this.db.select().from(authUsers).where(eq(authUsers.id, userId)).limit(1);
		return user;
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
