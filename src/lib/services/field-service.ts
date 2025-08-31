import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import { fields } from '$lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';

export interface CreateFieldInput {
	organizationId: string;
	name: string;
	location?: string | null;
	notes?: string | null;
	capacity?: number;
	active?: boolean;
}

export interface UpdateFieldInput {
	name?: string;
	location?: string | null;
	notes?: string | null;
	capacity?: number;
	active?: boolean;
}

export const fieldServiceKey = pbjKey<FieldService>('fieldService');
export class FieldService extends BaseService {
	constructor(db = pbj(drizzleKey)) {
		super(db);
	}

	async createField(input: CreateFieldInput) {
		const [row] = await this.db
			.insert(fields)
			.values({
				organizationId: input.organizationId,
				name: input.name,
				location: input.location ?? null,
				notes: input.notes ?? null,
				capacity: input.capacity ?? 1,
				active: input.active === false ? 0 : 1
			})
			.returning();
		return row;
	}

	async fetchField(organizationId: string, id: string) {
		const [row] = await this.db
			.select()
			.from(fields)
			.where(and(eq(fields.organizationId, organizationId), eq(fields.id, id)))
			.limit(1);
		return row ?? null;
	}

	async listFields(organizationId: string) {
		const rows = await this.db
			.select()
			.from(fields)
			.where(eq(fields.organizationId, organizationId))
			.orderBy(desc(fields.createdAt));
		return rows;
	}

	async updateField(organizationId: string, id: string, patch: UpdateFieldInput) {
		const [row] = await this.db
			.update(fields)
			.set({
				name: patch.name,
				location: patch.location,
				notes: patch.notes,
				capacity: patch.capacity,
				active: patch.active === undefined ? undefined : patch.active ? 1 : 0,
				updatedAt: new Date()
			})
			.where(and(eq(fields.organizationId, organizationId), eq(fields.id, id)))
			.returning();
		return row ?? null;
	}

	async deleteField(organizationId: string, id: string) {
		const [row] = await this.db
			.delete(fields)
			.where(and(eq(fields.organizationId, organizationId), eq(fields.id, id)))
			.returning({ id: fields.id });
		return row?.id ?? null;
	}
}
