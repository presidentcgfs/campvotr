import type { RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/db';
import { organizations, organizationMemberships, organizationInvites } from '$lib/db/schema';
import { and, count, eq, or, type InferSelectModel } from 'drizzle-orm';
import { drizzleKey } from '$lib/pbj';
import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { authUsers } from 'drizzle-orm/supabase';

export type OrgRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'MEMBER' | 'VIEWER';

export interface OrganizationContext {
	organization: {
		id: string;
		name: string;
		slug: string;
		logoUrl: string | null;
		primaryColor: string;
		secondaryColor: string;
		accentColor: string;
		primaryDomain?: string | null;
	};
	role: OrgRole | null;
}
export const organizationServiceKey = pbjKey<OrganizationService>('organizationService');
export class OrganizationService extends BaseService {
	async fetchOrganization(organizationId: string) {
		const [org] = await this.db
			.select()
			.from(organizations)
			.where(eq(organizations.id, organizationId))
			.limit(1);
		return org ?? null;
	}
	async fetchMemberships(userId: string) {
		const rows = await this.db
			.select({
				id: organizations.id,
				name: organizations.name,
				slug: organizations.slug,
				role: organizationMemberships.role
			})
			.from(organizationMemberships)
			.innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
			.where(or(eq(organizationMemberships.userId, userId), eq(organizations.creatorId, userId)));
		return rows;
	}

	async fetchOrganizationBySlug(slug: string) {
		const [org] = await this.db
			.select()
			.from(organizations)
			.where(eq(organizations.slug, slug))
			.limit(1);
		return org ?? null;
	}

	async fetchOrganizationByDomain(domain: string) {
		const host = domain.toLowerCase();
		const clean = host.startsWith('www.') ? host.slice(4) : host;
		const [org] = await this.db
			.select()
			.from(organizations)
			.where(or(eq(organizations.primaryDomain, clean), eq(organizations.primaryDomain, host)))
			.limit(1);
		return org ?? null;
	}

	async fetchMembership(userId: string, organizationId: string) {
		const [m] = await this.db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organizationId, organizationId),
					eq(organizationMemberships.userId, userId)
				)
			)
			.limit(1);
		return m ?? null;
	}

	deriveOrgSlug(event: RequestEvent): string | null {
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

	async resolveOrganizationContext(event: RequestEvent): Promise<OrganizationContext | null> {
		const slug = this.deriveOrgSlug(event);
		let org = null as any;
		if (slug) {
			org = await this.fetchOrganizationBySlug(slug);
		}
		if (!org) {
			const host = event.url.hostname.toLowerCase();
			const normalized = host.startsWith('www.') ? host.slice(4) : host;
			org = await this.fetchOrganizationByDomain(normalized);
		}
		const user = (event as any).locals?.user;

		if (!org && user) {
			org = (
				await this.db
					.select()
					.from(organizationMemberships)
					.leftJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
					.where(eq(organizationMemberships.userId, user.id))
					.limit(1)
			)?.[0]?.organizations;
		}
		if (!org) return null;

		let role: OrgRole | null = null;
		if (user) {
			const m = await this.fetchMembership(user.id, org.id);
			role = (m?.role as OrgRole) ?? null;
		}

		return {
			organization: {
				id: org.id,
				name: org.name,
				slug: org.slug,
				logoUrl: org.logoUrl ?? null,
				primaryColor: org.primaryColor,
				secondaryColor: org.secondaryColor,
				accentColor: org.accentColor
			},
			role
		};
	}
	async userHasRole(
		userId: string,
		organizationId: string,
		...allowed: OrgRole[]
	): Promise<boolean> {
		const m = await this.fetchMembership(userId, organizationId);
		return this.hasOrgRole(m?.role as OrgRole, allowed);
	}

	hasOrgRole(role: OrgRole | null, allowed: OrgRole[]): boolean {
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

	async requireOrgMembership(event: RequestEvent): Promise<OrganizationContext> {
		const ctx = await this.resolveOrganizationContext(event);
		if (!ctx) {
			throw new Response('Organization not found', { status: 404 });
		}
		const user = (event as any).locals?.user;
		if (!user) throw new Response('Unauthorized', { status: 401 });
		if (!ctx.role) throw new Response('Forbidden', { status: 403 });
		return ctx;
	}

	async requireOrgRole(event: RequestEvent, allowed: OrgRole[]): Promise<OrganizationContext> {
		const ctx = await this.requireOrgMembership(event);
		if (!this.hasOrgRole(ctx.role, allowed)) throw new Response('Forbidden', { status: 403 });
		return ctx;
	}

	async requireOrgMembershipForSlug(
		event: RequestEvent,
		slug: string
	): Promise<OrganizationContext> {
		const org = await this.fetchOrganizationBySlug(slug.toLowerCase());
		if (!org) throw new Response('Organization not found', { status: 404 });
		const user = (event as any).locals?.user;
		if (!user) throw new Response('Unauthorized', { status: 401 });
		const m = await this.fetchMembership(user.id, org.id);
		if (!m) throw new Response('Forbidden', { status: 403 });
		return {
			organization: {
				id: org.id,
				name: org.name,
				slug: org.slug,
				logoUrl: org.logoUrl ?? null,
				primaryColor: org.primaryColor,
				secondaryColor: org.secondaryColor,
				accentColor: org.accentColor
			},
			role: m.role as OrgRole
		};
	}

	async requireOrgRoleForSlug(
		event: RequestEvent,
		slug: string,
		allowed: OrgRole[]
	): Promise<OrganizationContext> {
		const ctx = await this.requireOrgMembershipForSlug(event, slug);
		if (!this.hasOrgRole(ctx.role, allowed)) throw new Response('Forbidden', { status: 403 });
		return ctx;
	}

	async requireOrgMembershipForId(
		event: RequestEvent,
		organizationId: string
	): Promise<OrganizationContext> {
		const org = await this.fetchOrganization(organizationId);
		if (!org) throw new Response('Organization not found', { status: 404 });
		const user = (event as any).locals?.user;
		if (!user) throw new Response('Unauthorized', { status: 401 });
		const m = await this.fetchMembership(user.id, org.id);
		if (!m) throw new Response('Forbidden', { status: 403 });
		return {
			organization: {
				id: org.id,
				name: org.name,
				slug: org.slug,
				logoUrl: org.logoUrl ?? null,
				primaryColor: org.primaryColor,
				secondaryColor: org.secondaryColor,
				accentColor: org.accentColor,
				primaryDomain: org.primaryDomain ?? null
			},
			role: m.role as OrgRole
		};
	}

	async requireOrgRoleForId(
		event: RequestEvent,
		organizationId: string,
		allowed: OrgRole[]
	): Promise<OrganizationContext> {
		const ctx = await this.requireOrgMembershipForId(event, organizationId);
		if (!this.hasOrgRole(ctx.role, allowed)) throw new Response('Forbidden', { status: 403 });
		return ctx;
	}

	async updateOrganization(
		id: string,
		data: Partial<Omit<InferSelectModel<typeof organizations>, 'id' | 'created_at' | 'updatedAt'>>
	) {
		return this.db
			.update(organizations)
			.set({
				...data,
				updatedAt: new Date()
			})
			.where(eq(organizations.id, id))
			.returning();
	}
	async updateRole(organizationId: string, userId: string, role: OrgRole) {
		if (role !== 'OWNER') {
			const [{ total }] = await db
				.select({ total: count() })
				.from(organizationMemberships)
				.where(
					and(
						eq(organizationMemberships.organizationId, organizationId),
						eq(organizationMemberships.role, 'OWNER')
					)
				);
			if (total === 1) {
				// Ensure the one being changed is an OWNER
				const [existing] = await db
					.select()
					.from(organizationMemberships)
					.where(
						and(
							eq(organizationMemberships.organizationId, organizationId),
							eq(organizationMemberships.userId, userId)
						)
					)
					.limit(1);
				if (existing?.role === 'OWNER') throw new Error('Cannot demote the last OWNER');
			}
		}

		const [updated] = await this.db
			.update(organizationMemberships)
			.set({ role, updatedAt: new Date() })
			.where(
				and(
					eq(organizationMemberships.organizationId, organizationId),
					eq(organizationMemberships.userId, userId)
				)
			)
			.returning();

		return updated;
	}

	async fetchMembers(organizationId: string) {
		const result = await this.db
			.select()
			.from(organizationMemberships)
			.leftJoin(authUsers, eq(organizationMemberships.userId, authUsers.id))
			.where(eq(organizationMemberships.organizationId, organizationId));
		return result.map((m) => ({
			...m.organization_memberships,
			user: m.users
		}));
	}

	async createOrUpdateMember(organizationId: string, userId: string, role: OrgRole) {
		const [member] = await this.db
			.insert(organizationMemberships)
			.values({ organizationId: organizationId, userId: userId, role })
			.onConflictDoUpdate({
				target: [organizationMemberships.organizationId, organizationMemberships.userId],
				set: { role, updatedAt: new Date() }
			})
			.returning();
		return member;
	}

	async createOrUpdateInvite(organizationId: string, email: string, role: OrgRole) {
		const [invite] = await this.db
			.insert(organizationInvites)
			.values({ organizationId, email, role })
			.onConflictDoUpdate({
				target: [organizationInvites.organizationId, organizationInvites.email],
				set: { role, updatedAt: new Date(), acceptedAt: null }
			})
			.returning();
		return invite;
	}

	async deleteMember(organizationId: string, userId: string) {
		// Check if this is the last owner
		const [existing] = await this.db
			.select()
			.from(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organizationId, organizationId),
					eq(organizationMemberships.userId, userId)
				)
			)
			.limit(1);

		if (!existing) {
			throw new Error('Member not found');
		}

		if (existing.role === 'OWNER') {
			const [{ total }] = await this.db
				.select({ total: count() })
				.from(organizationMemberships)
				.where(
					and(
						eq(organizationMemberships.organizationId, organizationId),
						eq(organizationMemberships.role, 'OWNER')
					)
				);
			if (total === 1) {
				throw new Error('Cannot remove the last OWNER');
			}
		}

		await this.db
			.delete(organizationMemberships)
			.where(
				and(
					eq(organizationMemberships.organizationId, organizationId),
					eq(organizationMemberships.userId, userId)
				)
			);

		return { success: true };
	}

	async setTieBreaker(organizationId: string, userId: string | null) {
		if (userId) {
			// Validate membership
			const m = await this.fetchMembership(userId, organizationId);
			if (!m) {
				throw new Error('User is not a member of this organization');
			}
		}

		const [updated] = await this.db
			.update(organizations)
			.set({ tieBreakerUserId: userId, updatedAt: new Date() })
			.where(eq(organizations.id, organizationId))
			.returning();

		return updated;
	}

	async getTieBreaker(organizationId: string) {
		const [org] = await this.db
			.select({ tie_breaker_userId: organizations.tieBreakerUserId })
			.from(organizations)
			.where(eq(organizations.id, organizationId))
			.limit(1);

		return org?.tie_breaker_userId ?? null;
	}

	static normalizeDomain(input: string): string | null {
		try {
			let s = input.trim().toLowerCase();
			s = s.replace(/^https?:\/\//, '');
			s = s.split('/')[0];
			s = s.split(':')[0];
			s = s.replace(/\.$/, '');
			if (!s) return null;
			if (s.length > 255) return null;
			const labels = s.split('.');
			if (labels.length < 2) return null;
			for (const label of labels) {
				if (!/^[a-z0-9-]+$/.test(label)) return null;
				if (!/[a-z0-9]/.test(label[0])) return null;
				if (!/[a-z0-9]/.test(label[label.length - 1])) return null;
				if (label.length === 0 || label.length > 63) return null;
			}
			return s;
		} catch {
			return null;
		}
	}
}
