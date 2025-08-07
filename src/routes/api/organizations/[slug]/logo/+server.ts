import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireOrgRoleForSlug } from '$lib/server/org';
import { rateLimit } from '$lib/server/rate-limit';
import { db } from '$lib/db';
import { organizations } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// In a real app, integrate S3/Supabase Storage. Here we accept file and return a placeholder URL.

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);

export const POST: RequestHandler = async (event) => {
	const slug = event.params.slug!;
	await requireOrgRoleForSlug(event, slug, ['OWNER', 'ADMIN']);
	const rl = rateLimit(event.getClientAddress?.() ?? '', `/api/org/${slug}/logo`, 10, 60_000);
	if (!rl.allowed) return json({ error: 'Too Many Requests' }, { status: 429 });

	const data = await event.request.formData();
	const file = data.get('file');
	if (!(file instanceof File)) return json({ error: 'No file' }, { status: 400 });
	if (!ALLOWED.has(file.type)) return json({ error: 'Invalid file type' }, { status: 422 });
	if (file.size > MAX_BYTES) return json({ error: 'File too large' }, { status: 413 });

	// TODO: Upload to storage provider e.g., organizations/{orgId}/logo
	// For now, we simulate a stored URL using a data URL or temporary path. Replace with real storage.
	const arrayBuf = await file.arrayBuffer();
	const base64 = Buffer.from(arrayBuf).toString('base64');
	const ext = file.type === 'image/png' ? 'png' : file.type === 'image/svg+xml' ? 'svg' : 'jpg';
	const fakeUrl = `data:${file.type};base64,${base64}`;

	const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
	if (!org) return json({ error: 'Not found' }, { status: 404 });

	await db
		.update(organizations)
		.set({ logo_url: fakeUrl, updated_at: new Date() })
		.where(eq(organizations.id, org.id));

	return json({ logoUrl: fakeUrl });
};
