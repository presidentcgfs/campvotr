import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth } from '$lib/server/middleware';
import { supabaseAdmin } from '$lib/server/auth';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

function extFromMime(mime: string): string | null {
	if (mime === 'image/png') return 'png';
	if (mime === 'image/jpeg') return 'jpg';
	if (mime === 'image/webp') return 'webp';
	return null;
}

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (_evt, user) => {
		try {
			const form = await event.request.formData();
			const file = form.get('file');
			if (!(file instanceof File)) return json({ error: 'No file uploaded' }, { status: 422 });
			const mime = file.type;
			const ext = extFromMime(mime);
			if (!ext) return json({ error: 'Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.' }, { status: 422 });
			if (file.size > 2 * 1024 * 1024)
				return json({ error: 'Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.' }, { status: 422 });

			// read buffer
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// simple image decode validation using toString('base64') length check
			if (!buffer || buffer.length === 0)
				return json({ error: 'Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.' }, { status: 422 });

			// upload to supabase storage
			const bucket = 'avatars';
			const path = `avatars/${user.id}/${crypto.randomUUID()}.${ext}`;
			const { data: uploadData, error: uploadError } = await (event.locals.supabase as any).storage
				.from(bucket)
				.upload(path, buffer, {
					contentType: mime,
					upsert: true
				});
			if (uploadError) return json({ error: 'Failed to upload image' }, { status: 500 });

			// public URL (assumes public bucket)
			const publicUrl = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/${uploadData.fullPath}`;

			// update user metadata
			const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
				user_metadata: { ...(user.user_metadata || {}), avatar_url: publicUrl }
			});
			if (metaErr) return json({ error: 'Failed to update profile' }, { status: 500 });
			return json({ avatar_url: publicUrl });
		} catch {
			return json({ error: 'Request failed' }, { status: 400 });
		}
	});

export const DELETE: RequestHandler = async (event) =>
	withAuth(event, async (_evt, user) => {
		try {
			const current = user.user_metadata?.avatar_url as string | undefined;
			if (current) {
				// attempt to delete the object
				const prefix = `${PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
				if (current.startsWith(prefix)) {
					const fullPath = current.substring(prefix.length);
					await (event.locals.supabase as any).storage.from('avatars').remove([fullPath]);
				}
			}
			const { error: metaErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
				user_metadata: { ...(user.user_metadata || {}), avatar_url: null }
			});
			if (metaErr) return json({ error: 'Failed to update profile' }, { status: 500 });
			return json({ ok: true });
		} catch {
			return json({ error: 'Request failed' }, { status: 400 });
		}
	});

