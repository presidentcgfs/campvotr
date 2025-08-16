<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from './Modal.svelte';
	import { type OrgRole } from '$lib/validation';

	export let organization: { id: string; slug: string; name: string };
	export let role: OrgRole | null;

	let loading = true;
	let error = '';
	let success = '';

	type Member = { organization_id: string; user_id: string; role: OrgRole };
	let members: Member[] = [];

	type PendingInvite = { email: string; role: OrgRole };
	let pendingInvites: PendingInvite[] = [];

	// Add form
	let email = '';
	let userId = '';
	let addRole: OrgRole = 'MEMBER';
	let submitting = false;

	// Edit/remove
	let updatingUserId: string | null = null;
	let removingUserId: string | null = null;
	let confirmOpen = false;

	let isAdmin = false;
	$: isAdmin = role === 'OWNER' || role === 'ADMIN';
	onMount(async () => {
		await fetchMembers();
	});

	async function fetchMembers() {
		if (!organization?.id) {
			return;
		}
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/organizations/${organization.id}/members`);
			if (!res.ok) throw await buildError(res);
			const data = await res.json();
			members = data.members ?? [];
		} catch (e: any) {
			error = e.message ?? 'Failed to load members';
		} finally {
			loading = false;
		}
	}

	async function buildError(res: Response) {
		const body = await safeJson(res);
		if (res.status === 401 || res.status === 403)
			return new Error('You don’t have permission to update organization members.');
		if (res.status === 404) return new Error('Organization not found.');
		if (res.status === 429) return new Error('Too many requests. Try again soon.');
		if (res.status === 409 || res.status === 422)
			return new Error(
				body?.error || 'Unable to update member; please check inputs and try again.'
			);
		return new Error(body?.error || 'Request failed. Try again.');
	}

	async function safeJson(res: Response) {
		try {
			return await res.json();
		} catch {
			return null;
		}
	}

	function validateAddInputs(): string | null {
		const hasEmail = email.trim() !== '';
		const hasUserId = userId.trim() !== '';
		if (hasEmail && hasUserId) return 'Provide either a user ID or an email (but not both).';
		if (!hasEmail && !hasUserId) return 'Provide either a user ID or an email (but not both).';
		if (hasEmail) {
			const v = email.trim();
			const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!re.test(v)) return 'Enter a valid email address.';
		}
		return null;
	}

	async function addMember() {
		error = '';
		success = '';
		const validation = validateAddInputs();
		if (validation) {
			error = validation;
			return;
		}
		submitting = true;
		try {
			const payload: any = { role: addRole };
			if (email.trim()) payload.email = email.trim();
			else payload.userId = userId.trim();
			const res = await fetch(`/api/organizations/${organization.id}/members`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) throw await buildError(res);
			const data = await res.json();
			if (data.member) {
				const m: Member = data.member;
				const idx = members.findIndex((x) => x.user_id === m.user_id);
				if (idx >= 0) members[idx] = m;
				else members = [...members, m];
				success = 'Member added';
			} else if (data.pending) {
				pendingInvites = [...pendingInvites, { email: payload.email, role: addRole }];
				success = 'Invitation sent';
			}
			email = '';
			userId = '';
			addRole = 'MEMBER';
			setTimeout(() => (success = ''), 2000);
		} catch (e: any) {
			error = e.message ?? 'Request failed. Try again.';
		} finally {
			submitting = false;
		}
	}

	async function changeRole(user_id: string, newRole: OrgRole) {
		error = '';
		updatingUserId = user_id;
		try {
			const res = await fetch(`/api/organizations/${organization.id}/members/${user_id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ role: newRole })
			});
			if (!res.ok) throw await buildError(res);
			const data = await res.json();
			const idx = members.findIndex((m) => m.user_id === user_id);
			if (idx >= 0) members[idx] = data.member;
		} catch (e: any) {
			error = e.message ?? 'Request failed. Try again.';
		} finally {
			updatingUserId = null;
		}
	}

	function confirmRemove(user_id: string) {
		removingUserId = user_id;
		confirmOpen = true;
	}

	async function removeMember() {
		if (!removingUserId) return;
		error = '';
		const user_id = removingUserId;
		try {
			const res = await fetch(`/api/organizations/${organization.id}/members/${user_id}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw await buildError(res);
			members = members.filter((m) => m.user_id !== user_id);
			confirmOpen = false;
			removingUserId = null;
		} catch (e: any) {
			error = e.message ?? 'Request failed. Try again.';
		}
	}
</script>

<div>
	{#if loading}
		<p>Loading…</p>
	{:else}
		{#if error}
			<p class="text-red-600">{error}</p>
		{/if}

		{#if isAdmin}
			<div
				class="mb-4 grid gap-2"
				aria-disabled={!isAdmin}
				title={!isAdmin ? 'You don’t have permission to manage members.' : undefined}
			>
				<div class="grid grid-cols-[2fr_1fr] items-center gap-2">
					<label for="member-email" class="block"
						>Email
						<input
							id="member-email"
							type="email"
							bind:value={email}
							placeholder="name@example.org"
							disabled={submitting || !isAdmin}
							class="focus:ring-primary mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 disabled:bg-gray-100"
						/>
					</label>
					<label for="member-role" class="block"
						>Role
						<select
							id="member-role"
							bind:value={addRole}
							disabled={submitting || !isAdmin}
							class="focus:ring-primary mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 disabled:bg-gray-100"
						>
							<option>OWNER</option>
							<option>ADMIN</option>
							<option>EDITOR</option>
							<option>MEMBER</option>
							<option>VIEWER</option>
						</select>
					</label>
				</div>
				<button
					class="bg-primary hover:bg-primary/90 rounded-md px-4 py-2 text-white disabled:bg-gray-300"
					onclick={addMember}
					disabled={submitting || !isAdmin}
				>
					Add member
				</button>
				{#if success}<p class="text-green-600">{success}</p>{/if}
			</div>
		{/if}

		<div>
			{#if members.length === 0 && pendingInvites.length === 0}
				<p>No members yet.</p>
			{/if}

			{#if members.length > 0}
				<table class="w-full border-collapse">
					<thead>
						<tr>
							<th class="border-b border-gray-200 p-2 text-left">User</th>
							<th class="border-b border-gray-200 p-2 text-left">Role</th>
							<th class="border-b border-gray-200 p-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each members as m}
							<tr>
								<td class="border-b border-gray-200 p-2 font-mono text-xs">{m.user.email}</td>
								<td class="border-b border-gray-200 p-2">
									{#if isAdmin}
										<select
											bind:value={m.role}
											disabled={updatingUserId === m.user_id}
											onchange={(e) =>
												changeRole(m.user_id, (e.target as HTMLSelectElement).value as OrgRole)}
											class="focus:ring-primary rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 disabled:bg-gray-100"
										>
											<option>OWNER</option>
											<option>ADMIN</option>
											<option>EDITOR</option>
											<option>MEMBER</option>
											<option>VIEWER</option>
										</select>
									{:else}
										{m.role}
									{/if}
								</td>
								<td class="border-b border-gray-200 p-2 text-right">
									{#if isAdmin}
										<button
											class="bg-transparent text-blue-600 hover:underline"
											onclick={() => confirmRemove(m.user_id)}
										>
											Remove
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			{#if pendingInvites.length > 0}
				<h4 class="mb-2 mt-4 font-semibold">Pending invites</h4>
				<table class="w-full border-collapse">
					<thead>
						<tr>
							<th class="border-b border-gray-200 p-2 text-left">Email</th>
							<th class="border-b border-gray-200 p-2 text-left">Role</th>
						</tr>
					</thead>
					<tbody>
						{#each pendingInvites as inv}
							<tr>
								<td class="border-b border-gray-200 p-2">{inv.email}</td>
								<td class="border-b border-gray-200 p-2">
									{inv.role}
									<span class="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-gray-900">
										pending
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}

	<Modal bind:open={confirmOpen} title="Remove member" role="alertdialog">
		<p>Are you sure you want to remove this member? This action cannot be undone.</p>
		<div slot="footer" class="flex gap-2">
			<button
				class="rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
				onclick={() => (confirmOpen = false)}
			>
				Cancel
			</button>
			<button
				class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
				onclick={removeMember}
			>
				Remove
			</button>
		</div>
	</Modal>
</div>
