import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db';
import { organizations, organizationMemberships } from '$lib/db/schema';
import { and, eq, or } from 'drizzle-orm';

export type OrgRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'MEMBER' | 'VIEWER';

export interface OrganizationContext {
	organization: {
		id: string;
		name: string;
		slug: string;
		logo_url: string | null;
		primary_color: string;
		secondary_color: string;
		accent_color: string;
		primary_domain?: string | null;
	};
	role: OrgRole | null;
}

export async function fetchOrganizationBySlug(slug: string) {
	const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
	return org ?? null;
}

export async function fetchOrganizationByDomain(domain: string) {
	const host = domain.toLowerCase();
	const clean = host.startsWith('www.') ? host.slice(4) : host;
	const [org] = await db
		.select()
		.from(organizations)
		.where(or(eq(organizations.primary_domain, clean), eq(organizations.primary_domain, host)))
		.limit(1);
	return org ?? null;
}

export async function fetchMembership(userId: string, organizationId: string) {
	const [m] = await db
		.select()
		.from(organizationMemberships)
		.where(
			and(
				eq(organizationMemberships.organization_id, organizationId),
				eq(organizationMemberships.user_id, userId)
			)
		)
		.limit(1);
	return m ?? null;
}

export function deriveOrgSlug(event: RequestEvent): string | null {
	// Precedence:
	// 1) X-ORG-SLUG header
	// 2) ?org URL param
	// 3) Hostname exact match to organizations.primary_domain
	// 4) Subdomain-based lookup (tenant.example.com)
	// 5) Cookie fallback
	const headerSlug = event.request.headers.get('x-org-slug');
	if (headerSlug) return headerSlug.toLowerCase();

	const urlOrgParam = event.url.searchParams.get('org');
	if (urlOrgParam) return urlOrgParam.toLowerCase();

	const host = event.url.hostname.toLowerCase();
	// We do not resolve to a slug here, only return null to let resolveOrganizationContext do domain lookup
	// so that both slug and domain paths are supported.

	// Subdomain style: tenant.example.com; ignore localhost and IPs
	const parts = host.split('.');
	if (parts.length > 2 && host !== 'localhost') {
		const candidate = parts[0];
		if (candidate && candidate !== 'www') return candidate.toLowerCase();
	}

	const cookieSlug = event.cookies.get('org');
	if (cookieSlug) return cookieSlug.toLowerCase();

	return null;
}

export async function resolveOrganizationContext(
	event: RequestEvent
): Promise<OrganizationContext | null> {
	const slug = deriveOrgSlug(event);
	let org = null as any;
	if (slug) {
		org = await fetchOrganizationBySlug(slug);
	}
	if (!org) {
		const host = event.url.hostname.toLowerCase();
		const normalized = host.startsWith('www.') ? host.slice(4) : host;
		org = await fetchOrganizationByDomain(normalized);
	}
	if (!org) return null;

	const user = (event as any).locals?.user;
	let role: OrgRole | null = null;
	if (user) {
		const m = await fetchMembership(user.id, org.id);
		role = (m?.role as OrgRole) ?? null;
	}

	return {
		organization: {
			id: org.id,
			name: org.name,
			slug: org.slug,
			logo_url: org.logo_url ?? null,
			primary_color: org.primary_color,
			secondary_color: org.secondary_color,
			accent_color: org.accent_color
		},
		role
	};
}

export function hasOrgRole(role: OrgRole | null, allowed: OrgRole[]): boolean {
	if (!role) return false;
	// Map role hierarchy
	const order: Record<OrgRole, number> = {
		OWNER: 5,
		ADMIN: 4,
		EDITOR: 3,
		MEMBER: 2,
		VIEWER: 1
	};
	const min = Math.min(...allowed.map((r) => order[r]));
	// Allow if user's role >= minimum of allowed set
	return order[role] >= min;
}

export async function requireOrgMembership(event: RequestEvent): Promise<OrganizationContext> {
	const ctx = await resolveOrganizationContext(event);
	if (!ctx) {
		throw new Response('Organization not found', { status: 404 });
	}
	const user = (event as any).locals?.user;
	if (!user) throw new Response('Unauthorized', { status: 401 });
	if (!ctx.role) throw new Response('Forbidden', { status: 403 });
	return ctx;
}

export async function requireOrgRole(
	event: RequestEvent,
	allowed: OrgRole[]
): Promise<OrganizationContext> {
	const ctx = await requireOrgMembership(event);
	if (!hasOrgRole(ctx.role, allowed)) throw new Response('Forbidden', { status: 403 });
	return ctx;
}

export async function requireOrgMembershipForSlug(
	event: RequestEvent,
	slug: string
): Promise<OrganizationContext> {
	const org = await fetchOrganizationBySlug(slug.toLowerCase());
	if (!org) throw new Response('Organization not found', { status: 404 });
	const user = (event as any).locals?.user;
	if (!user) throw new Response('Unauthorized', { status: 401 });
	const m = await fetchMembership(user.id, org.id);
	if (!m) throw new Response('Forbidden', { status: 403 });
	return {
		organization: {
			id: org.id,
			name: org.name,
			slug: org.slug,
			logo_url: org.logo_url ?? null,
			primary_color: org.primary_color,
			secondary_color: org.secondary_color,
			accent_color: org.accent_color
		},
		role: m.role as OrgRole
	};
}

export async function requireOrgRoleForSlug(
	event: RequestEvent,
	slug: string,
	allowed: OrgRole[]
): Promise<OrganizationContext> {
	const ctx = await requireOrgMembershipForSlug(event, slug);
	if (!hasOrgRole(ctx.role, allowed)) throw new Response('Forbidden', { status: 403 });
	return ctx;
}
