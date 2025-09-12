import type { Actions, PageServerLoad } from './$types';
import { withAuthRedirect } from '$lib/services/middleware';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { userServiceKey } from '$lib/services/user-service';
import { fieldServiceKey } from '$lib/services/field-service';
import { timeSlotServiceKey } from '$lib/services/timeslot-service';

export const load = withAuthRedirect<PageServerLoad>(
	async ({ locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { orgId: null, sessions: [], fields: [] } as any;
		const svc = resolve(drawSessionServiceKey);
		const fsvc = resolve(fieldServiceKey);
		const sessions = await svc.listSessions(orgId);
		const fields = await fsvc.listFields(orgId);

		return { orgId, sessions, fields } as const;
	}
);

export const actions: Actions = {
	create: withAuthRedirect(async ({ request, locals: { resolve, organizationContext, user } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };

		const form = await request.formData();
		const name = String(form.get('name') || '').trim();
		const turnStrategy = String(form.get('turnStrategy') || 'fixed') as any;
		const roundsStr = String(form.get('rounds') || '').trim();
		const rounds = roundsStr ? Number(roundsStr) : null;
		const pickTimeoutSec = Number(form.get('pickTimeoutSec') || '60');
		const startsAt = String(form.get('startsAtUtc') || '').trim();
		const participantsText = String(form.get('participants') || '').trim();

		if (!name) return { error: 'Name is required' };
		const startsAtUtc = startsAt ? new Date(startsAt) : new Date();

		// Parse participants: accept comma/newline separated emails; optional role via `email:role`
		const rawEntries = participantsText
			.split(/\r?\n|,/)
			.map((s) => s.trim())
			.filter(Boolean);
		const emailRolePairs = rawEntries.map((entry) => {
			const [emailRaw, roleRaw] = entry.split(':');
			return {
				email: (emailRaw || '').trim().toLowerCase(),
				role: (roleRaw || '').trim() || undefined
			};
		});

		if (emailRolePairs.length > 200) {
			return { error: 'Too many participants (max 200)' };
		}

		const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		const invalid = emailRolePairs.filter((p) => !emailRe.test(p.email)).map((p) => p.email);
		if (invalid.length) {
			return { error: `Invalid emails: ${invalid.join(', ')}` };
		}

		// Resolve emails to user IDs within this organization
		const uSvc = resolve(userServiceKey);
		const resolved: { userId: string; role?: string }[] = [];
		const unknown: string[] = [];
		for (const p of emailRolePairs) {
			const m = await uSvc.findMemberByEmail(orgId, p.email);
			if (!m) unknown.push(p.email);
			else resolved.push({ userId: m.userId, role: p.role });
		}
		if (unknown.length) {
			return { error: `Unknown emails: ${unknown.join(', ')}` };
		}

		// New recurring schedule inputs: date range (UTC), per-field time windows, and days
		const startDateStr = String(form.get('startDate') || '').trim();
		const endDateStr = String(form.get('endDate') || '').trim();
		const daysStr = String(form.get('days') || '').trim(); // e.g., "MO,TU,WE"
		const fieldWindowsRaw = String(form.get('fieldWindows') || '[]').trim();

		if (!startDateStr || !endDateStr) return { error: 'Start and end date are required (UTC)' };
		if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr))
			return { error: 'Dates must be in YYYY-MM-DD format (UTC)' };
		const startDate = new Date(`${startDateStr}T00:00:00Z`);
		const endDate = new Date(`${endDateStr}T00:00:00Z`);
		if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate)
			return { error: 'End date must be on or after start date (UTC)' };

		// Parse per-field windows
		let fieldWindows: { fieldId: string; windows: { startTime: string; endTime: string }[] }[] = [];
		try {
			fieldWindows = JSON.parse(fieldWindowsRaw);
		} catch {
			return { error: 'Invalid fieldWindows payload' };
		}
		if (!Array.isArray(fieldWindows) || fieldWindows.length === 0)
			return { error: 'Select at least one Field and add its time windows' };
		const timeRe = /^\d{2}:\d{2}$/;
		const toMinutes = (hhmm: string) => {
			const [h, m] = hhmm.split(':').map((n) => Number(n));
			return h * 60 + m;
		};
		// Validate windows per field and normalize to minutes
		const windowsMinsByField: { fieldId: string; mins: { stMin: number; enMin: number }[] }[] = [];
		const selectedFieldIds = fieldWindows.map((fw) => String(fw.fieldId)).filter(Boolean);
		for (const fw of fieldWindows) {
			if (!fw.fieldId) return { error: 'Missing fieldId in fieldWindows' };
			const mins: { stMin: number; enMin: number }[] = [];
			if (!Array.isArray(fw.windows) || fw.windows.length === 0)
				return { error: 'Each selected Field must have at least one time window' };
			for (const w of fw.windows) {
				const st = (w?.startTime || '').trim();
				const en = (w?.endTime || '').trim();
				if (!timeRe.test(st) || !timeRe.test(en))
					return { error: 'Start and end times are required in HH:mm (UTC)' };
				const stMin = toMinutes(st);
				const enMin = toMinutes(en);
				if (!(enMin > stMin)) return { error: 'End time must be after start time (same UTC day)' };
				mins.push({ stMin, enMin });
			}
			mins.sort((a, b) => a.stMin - b.stMin);
			for (let i = 1; i < mins.length; i++)
				if (mins[i - 1].enMin > mins[i].stMin)
					return { error: 'Time windows overlap within a day for a Field' };
			windowsMinsByField.push({ fieldId: fw.fieldId, mins });
		}

		const dayCodes = daysStr
			? daysStr
					.split(',')
					.map((d) => d.trim())
					.filter(Boolean)
			: [];
		if (dayCodes.length === 0) return { error: 'Select at least one day of week' };
		const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
		const daySet = new Set(dayCodes);
		for (const d of dayCodes) if (!DAY_CODES.includes(d)) return { error: 'Invalid day code' };

		// Validate fields belong to org
		const fsvc = resolve(fieldServiceKey);
		const fields = await fsvc.listFields(orgId);
		const fieldSet = new Set(fields.map((f: any) => f.id));
		for (const id of selectedFieldIds)
			if (!fieldSet.has(id)) return { error: 'Unknown Field specified' };

		// Expand to concrete UTC slots across dates, fields, and each field's daily windows
		const prepared: { fieldId: string; startUtc: Date; endUtc: Date }[] = [];
		for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
			const code = DAY_CODES[d.getUTCDay()];
			if (!daySet.has(code)) continue;
			for (const fw of windowsMinsByField) {
				for (const w of fw.mins) {
					const startUtc = new Date(
						Date.UTC(
							d.getUTCFullYear(),
							d.getUTCMonth(),
							d.getUTCDate(),
							Math.floor(w.stMin / 60),
							w.stMin % 60
						)
					);
					const endUtc = new Date(
						Date.UTC(
							d.getUTCFullYear(),
							d.getUTCMonth(),
							d.getUTCDate(),
							Math.floor(w.enMin / 60),
							w.enMin % 60
						)
					);
					if (!(startUtc < endUtc))
						return { error: 'Each slot must have Start < End (UTC same-day)' };
					prepared.push({ fieldId: fw.fieldId, startUtc, endUtc });
					if (prepared.length > 500) return { error: 'Too many generated time slots (max 500)' };
				}
			}
		}

		// Create the draw session first
		const svc = resolve(drawSessionServiceKey);
		const created = await svc.createSession({
			organizationId: orgId,
			name,
			turnStrategy,
			rounds,
			pickTimeoutSec,
			startsAtUtc,
			createdByUserId: user.id,
			participants: resolved
		});

		// Now create the time slots with the draw session ID
		const tsvc = resolve(timeSlotServiceKey);
		const { created: createdSlots, error: slotsError } = await tsvc.bulkCreateIfValid(
			created.id,
			prepared
		);
		if (slotsError) {
			// TODO: Consider rolling back the draw session creation
			return { error: `Session created but slots failed: ${slotsError}` };
		}

		return { success: true, created, createdSlots };
	}) as any,

	start: withAuthRedirect(async ({ request, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };
		const form = await request.formData();
		const id = String(form.get('id') || '').trim();
		if (!id) return { error: 'Missing id' };
		const svc = resolve(drawSessionServiceKey);
		const updated = await svc.updateStatus(orgId, id, 'active');
		return { success: true, updated };
	}) as any,

	pause: withAuthRedirect(async ({ request, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };
		const form = await request.formData();
		const id = String(form.get('id') || '').trim();
		if (!id) return { error: 'Missing id' };
		const svc = resolve(drawSessionServiceKey);
		const updated = await svc.updateStatus(orgId, id, 'paused');
		return { success: true, updated };
	}) as any,

	resume: withAuthRedirect(async ({ request, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };
		const form = await request.formData();
		const id = String(form.get('id') || '').trim();
		if (!id) return { error: 'Missing id' };
		const svc = resolve(drawSessionServiceKey);
		const updated = await svc.updateStatus(orgId, id, 'active');
		return { success: true, updated };
	}) as any,

	cancel: withAuthRedirect(async ({ request, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };
		const form = await request.formData();
		const id = String(form.get('id') || '').trim();
		if (!id) return { error: 'Missing id' };
		const svc = resolve(drawSessionServiceKey);
		const updated = await svc.updateStatus(orgId, id, 'cancelled');
		return { success: true, updated };
	}) as any,

	complete: withAuthRedirect(async ({ request, locals: { resolve, organizationContext } }) => {
		const orgId = organizationContext?.organization?.id;
		if (!orgId) return { error: 'No organization in context' };
		const form = await request.formData();
		const id = String(form.get('id') || '').trim();
		if (!id) return { error: 'Missing id' };
		const svc = resolve(drawSessionServiceKey);
		const updated = await svc.updateStatus(orgId, id, 'completed');
		return { success: true, updated };
	}) as any
};
