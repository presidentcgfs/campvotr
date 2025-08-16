import { pbj, pbjKey } from '@pbinj/pbj';
import { BaseService } from './base-service';
import { drizzleKey } from '$lib/pbj';
import { voters } from '$lib/db/schema';
import { eq, ilike, or } from 'drizzle-orm';

export const voterServiceKey = pbjKey<VoterService>('voterService');
export class VoterService extends BaseService {
  constructor(db = pbj(drizzleKey)) { super(db); }

  async search(params: { query?: string | null; limit?: number }) {
    const base = this.db.select().from(voters);
    const q = params.query?.trim();
    const limited = params.limit ?? 50;
    const rows = await (
      q
        ? base.where(or(ilike(voters.email, `%${q}%`), ilike(voters.name, `%${q}%`)))
        : base
    )
      .limit(limited)
      .orderBy(voters.created_at);
    return rows;
  }

  async linkToUserByEmail(email: string, userId: string) {
    const [existing] = await this.db.select().from(voters).where(eq(voters.email, email)).limit(1);
    if (!existing) return { error: 'not_found' as const };
    if (existing.user_id) return { error: 'already_linked' as const };
    const [updated] = await this.db
      .update(voters)
      .set({ user_id: userId })
      .where(eq(voters.id, existing.id))
      .returning();
    return { voter: updated };
  }

  async create(email: string, name?: string | null) {
    const [existing] = await this.db.select().from(voters).where(eq(voters.email, email)).limit(1);
    if (existing) return { error: 'exists' as const };
    const [created] = await this.db.insert(voters).values({ email, name }).returning();
    return { voter: created };
  }
}

