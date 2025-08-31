// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { OrganizationContext } from '$lib/services/org';
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import { Context } from '@pbinj/pbj';
import type { Temporal } from '@js-temporal/polyfill';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			session: Session | null;
			user: User | null;
			organizationContext: OrganizationContext | null;
			resolve: Context['resolve'];
		}
		interface PageData {
			session: Session | null;
			user: User | null;
		}
	}
	interface Date {
		toTemporalInstant(): Temporal.Instant;
	}
}

export {};
