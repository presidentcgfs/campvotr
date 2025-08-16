import { voterListMembers, voterLists, voters } from '$lib/db';
import { drizzleKey } from '$lib/pbj';
import { pbj, pbjKey } from '@pbinj/pbj';
import { and, eq, inArray } from 'drizzle-orm';
import { authUsers } from 'drizzle-orm/supabase';
import { BaseService } from './base-service';

export const voterListServiceKey = pbjKey<VoterListService>('voterListService');
export class VoterListService extends BaseService {
	constructor(db = pbj(drizzleKey)) {
		super(db);
	}
	async fetchOwnedList(voterListId: string, userId: string) {
		const [voterList] = await this.db
			.select()
			.from(voterLists)
			.where(and(eq(voterLists.id, voterListId), eq(voterLists.created_by, userId)))
			.limit(1);
		return voterList ?? null;
	}
	async updateVoterList(
		voterListId: string,
		{
			name,
			description,
			voterEmails
		}: { name?: string; description?: string; voterEmails?: string[] }
	) {
		await this.db
			.update(voterLists)
			.set({
				name,
				description,
				updated_at: new Date()
			})
			.where(eq(voterLists.id, voterListId))
			.returning();

		const existingMap = new Map(
			(
				await this.db
					.select()
					.from(voterListMembers)
					.leftJoin(voters, eq(voterListMembers.voter_id, voters.id))
					.where(eq(voterListMembers.voter_list_id, voterListId))
			).map((v) => [v.voters?.email!, v.voter_list_members.id] as const)
		);

		const deleteIds = new Set<string>();
		const newEmails = new Set<string>(voterEmails);
		existingMap.entries().forEach(([email, id]) => {
			if (newEmails.has(email)) {
				//do mot need to add this email
				newEmails.delete(email);
			} else {
				//need to delete this
				deleteIds.add(id);
			}
		});
		if (deleteIds.size) {
			await this.db.delete(voterListMembers).where(inArray(voterListMembers.id, [...deleteIds]));
		}
		const inserts = [];
		for (const email of newEmails) {
			const existingVoter = await this.findOrCreateVoter(email);
			inserts.push({ voter_list_id: voterListId, voter_id: existingVoter.id });
		}
		await this.db.insert(voterListMembers).values(
			await Promise.all(
				Array.from(newEmails, async (email) => {
					const existingVoter = await this.findOrCreateVoter(email);
					return { voter_list_id: voterListId, voter_id: existingVoter.id };
				})
			)
		);
	}

	async fetchById(voterListId: string) {
		const [voterList] = await this.db
			.select()
			.from(voterLists)
			.where(eq(voterLists.id, voterListId))
			.limit(1);
		return voterList ?? null;
	}

	async findOrCreateVoter(email: string) {
		const [existingVoter = (await this.db.insert(voters).values({ email }).returning())?.[0]] =
			await this.db.select().from(voters).where(eq(voters.email, email)).limit(1);
		return existingVoter;
	}
	async findVoterListMembers(voterListId: string) {
		const members = await this.db
			.select()
			.from(voterListMembers)
			.where(eq(voterListMembers.voter_list_id, voterListId));
		return members;
	}
	async findListsWithUser(userId: string) {
		const lists = await this.db
			.selectDistinctOn([voterLists.id])
			.from(voterLists)
			.leftJoin(voterListMembers, eq(voterLists.id, voterListMembers.voter_list_id))
			.leftJoin(voters, eq(voterListMembers.voter_id, voters.id))
			.leftJoin(authUsers, eq(voters.email, authUsers.email))
			.where(eq(authUsers.id, userId));
		return lists.map((l) => l.voter_lists);
	}

	async findVoterMmebers(voterListId: string) {
		return this.db
			.select({
				id: voters.id,
				email: voters.email,
				name: voters.name,
				user_id: voters.user_id,
				added_at: voterListMembers.added_at
			})
			.from(voterListMembers)
			.innerJoin(voters, eq(voterListMembers.voter_id, voters.id))
			.where(eq(voterListMembers.voter_list_id, voterListId))
			.orderBy(voterListMembers.added_at);
	}
}
