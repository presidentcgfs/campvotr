// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { OrganizationContext } from '$lib/server/org';
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			session: Session | null;
			user: User | null;
			organizationContext: OrganizationContext | null;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
		}
	}
}

export {};
