import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { rateLimit } from '$lib/services/rate-limit';
import { organizationServiceKey } from '$lib/services/org';
import { withAuth } from '$lib/services/middleware';

// In a real app, integrate S3/Supabase Storage. Here we accept file and return a placeholder URL.

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (event) => {
		const id = event.params.id!;
		const orgService = event.locals.resolve(organizationServiceKey);

		const rl = rateLimit(event.getClientAddress?.() ?? '', `/api/org/${id}/logo`, 10, 60_000);
		if (!rl.allowed) return json({ error: 'Too Many Requests' }, { status: 429 });

		await orgService.requireOrgRoleForId(event, id, ['OWNER', 'ADMIN']);

		const data = await event.request.formData();
		const file = data.get('file');

		if (!(file instanceof File)) return json({ error: 'No file' }, { status: 400 });
		if (!ALLOWED.has(file.type)) return json({ error: 'Invalid file type' }, { status: 422 });
		if (file.size > MAX_BYTES) return json({ error: 'File too large' }, { status: 413 });

		// TODO: Upload to storage provider e.g., organizations/{orgId}/logo
		// For now, we simulate a stored URL using a data URL or temporary path. Replace with real storage.
		const arrayBuf = await file.arrayBuffer();
		const base64 = Buffer.from(arrayBuf).toString('base64');
		const fakeUrl = `data:${file.type};base64,${base64}`;

		await orgService.updateOrganization(id, { logo_url: fakeUrl });

		return json({ logoUrl: fakeUrl });
	});
