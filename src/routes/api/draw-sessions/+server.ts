import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { withAuth, handleError } from '$lib/services/middleware';
import { drawSessionServiceKey } from '$lib/services/draw-session-service';
import { userServiceKey } from '$lib/services/user-service';
import { timeSlotServiceKey, type FieldSchedulesInput } from '$lib/services/timeslot-service';

interface CreateBody {
	name: string;
	turnStrategy: 'fixed' | 'randomized' | 'snake';
	rounds?: number | null;
	pickTimeoutSec: number;
	startsAtUtc?: string | null; // ISO; treat as UTC
	participants: string[]; // entries like "email" or "email:role"
	fieldSchedules: FieldSchedulesInput[]; // per-field schedules
}

export const POST: RequestHandler = async (event) =>
	withAuth(event, async (evt, user) => {
		try {
			const orgId = evt.locals.organizationContext?.organization?.id;
			if (!orgId) return json({ error: 'No organization in context' }, { status: 400 });

			const raw = (await evt.request.json()) as any;
			// Transform drawSchedules -> fieldSchedules (schedule-centric to per-field) if provided
			if (Array.isArray(raw?.drawSchedules) && raw.drawSchedules.length > 0) {
				const acc: Record<string, any[]> = {};
				for (const s of raw.drawSchedules) {
					const fids: string[] = Array.isArray(s?.fieldIds) ? s.fieldIds : [];
					const days: string[] = Array.isArray(s?.days) ? s.days : [];
					const windows = Array.isArray(s?.windows)
						? s.windows.map((w: any) => ({
								startTime: String(w?.startTime || ''),
								endTime: String(w?.endTime || '')
							}))
						: [];
					for (const fid of fids) {
						(acc[fid] ||= []).push({
							startDate: String(s?.startDate || ''),
							endDate: String(s?.endDate || ''),
							days,
							windows
						});
					}
				}
				raw.fieldSchedules = Object.entries(acc).map(([fieldId, schedules]) => ({
					fieldId,
					schedules
				}));
			}
			const body = raw as Partial<CreateBody>;
			if (!body?.name) return json({ error: 'Name is required' }, { status: 400 });
			if (!Array.isArray(body.fieldSchedules) || body.fieldSchedules.length === 0)
				return json(
					{ error: 'Provide at least one Schedule with at least one Field' },
					{ status: 400 }
				);

			// Participants validation: emails or email:role
			const entries = Array.isArray(body.participants) ? body.participants : [];
			if (entries.length > 200)
				return json({ error: 'Too many participants (max 200)' }, { status: 400 });
			const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			const parsed = entries
				.map((e) => String(e || '').trim())
				.filter(Boolean)
				.map((e) => {
					const [emailRaw, roleRaw] = e.split(':');
					return {
						email: (emailRaw || '').trim().toLowerCase(),
						role: (roleRaw || '').trim() || undefined
					};
				});
			const invalid = parsed.filter((p) => !emailRe.test(p.email)).map((p) => p.email);
			if (invalid.length)
				return json({ error: `Invalid emails: ${invalid.join(', ')}` }, { status: 400 });

			// Resolve members to userIds in this org
			const uSvc = evt.locals.resolve(userServiceKey);
			const resolved: { userId: string; role?: string }[] = [];
			const unknown: string[] = [];
			for (const p of parsed) {
				const m = await uSvc.findMemberByEmail(orgId, p.email);
				if (!m) unknown.push(p.email);
				else resolved.push({ userId: m.userId, role: p.role });
			}
			if (unknown.length)
				return json({ error: `Unknown emails: ${unknown.join(', ')}` }, { status: 400 });

			// Generate slots from per-field schedules (server-side UTC handling)
			const tsvc = evt.locals.resolve(timeSlotServiceKey);
			const { total, perField, error } = await tsvc.createFromFieldSchedules(
				orgId,
				body.fieldSchedules!,
				500
			);
			if (error) return json({ error }, { status: 400 });

			// Create draw session
			const dsvc = evt.locals.resolve(drawSessionServiceKey);
			const startsAtUtc = body.startsAtUtc ? new Date(body.startsAtUtc) : new Date();
			const created = await dsvc.createSession({
				organizationId: orgId,
				name: body.name!,
				turnStrategy: (body.turnStrategy || 'fixed') as any,
				rounds: body.rounds ?? null,
				pickTimeoutSec: Number(body.pickTimeoutSec || 60),
				startsAtUtc,
				createdByUserId: user.id,
				participants: resolved
			});

			return json(
				{ success: true, session: created, generated: { total, perField } },
				{ status: 201 }
			);
		} catch (e) {
			return handleError(e);
		}
	});
