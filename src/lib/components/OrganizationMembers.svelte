<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from './Modal.svelte';
	import { type OrgRole } from '$lib/validation';
	import { z } from 'zod';

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
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/organizations/${organization.slug}/members`);
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
			const res = await fetch(`/api/organizations/${organization.slug}/members`, {
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
			const res = await fetch(`/api/organizations/${organization.slug}/members/${user_id}`, {
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
			const res = await fetch(`/api/organizations/${organization.slug}/members/${user_id}`, {
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

<div class="members">
	{#if loading}
		<p>Loading…</p>
	{:else}
		{#if error}
			<p class="error">{error}</p>
		{/if}

		{#if isAdmin}
			<div
				class="add-form"
				aria-disabled={!isAdmin}
				title={!isAdmin ? 'You don’t have permission to manage members.' : undefined}
			>
				<div class="fields">
					<label for="member-email"
						>Email
						<input
							id="member-email"
							type="email"
							bind:value={email}
							placeholder="name@example.org"
							disabled={submitting || !isAdmin}
						/>
					</label>
					<label for="member-role"
						>Role
						<select id="member-role" bind:value={addRole} disabled={submitting || !isAdmin}>
							<option>OWNER</option>
							<option>ADMIN</option>
							<option>EDITOR</option>
							<option>MEMBER</option>
							<option>VIEWER</option>
						</select>
					</label>
				</div>
				<button class="btn" on:click={addMember} disabled={submitting || !isAdmin}
					>Add member</button
				>
				{#if success}<p class="success">{success}</p>{/if}
			</div>
		{/if}

		<div class="list">
			{#if members.length === 0 && pendingInvites.length === 0}
				<p>No members yet.</p>
			{/if}

			{#if members.length > 0}
				<table>
					<thead>
						<tr><th>User</th><th>Role</th><th></th></tr>
					</thead>
					<tbody>
						{#each members as m}
							<tr>
								<td class="mono">{m.user?.email}</td>
								<td>
									{#if isAdmin}
										<select
											bind:value={m.role}
											disabled={updatingUserId === m.user_id}
											on:change={(e) =>
												changeRole(m.user_id, (e.target as HTMLSelectElement).value as OrgRole)}
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
								<td class="actions">
									{#if isAdmin}
										<button class="link" on:click={() => confirmRemove(m.user_id)}>Remove</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			{#if pendingInvites.length > 0}
				<h4>Pending invites</h4>
				<table>
					<thead>
						<tr><th>Email</th><th>Role</th></tr>
					</thead>
					<tbody>
						{#each pendingInvites as inv}
							<tr class="pending">
								<td>{inv.email}</td>
								<td>{inv.role} <span class="badge">pending</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}

	<Modal bind:open={confirmOpen} title="Remove member" role="alertdialog">
		<p>Are you sure you want to remove this member? This action cannot be undone.</p>
		<div slot="footer">
			<button class="btn" on:click={() => (confirmOpen = false)}>Cancel</button>
			<button class="btn danger" on:click={removeMember}>Remove</button>
		</div>
	</Modal>
</div>

<style>
	.error {
		color: #dc2626;
	}
	.success {
		color: #16a34a;
	}
	.mono {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 12px;
	}
	.add-form {
		margin-bottom: 1rem;
		display: grid;
		gap: 0.5rem;
	}
	.fields {
		display: grid;
		grid-template-columns: 2fr 1fr;
		align-items: center;
		gap: 0.5rem;
	}

	.list table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		padding: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}
	.badge {
		background: #f59e0b;
		color: #111827;
		font-size: 12px;
		border-radius: 9999px;
		padding: 2px 8px;
		margin-left: 6px;
	}
	.link {
		color: #2563eb;
		background: transparent;
	}
	.btn.danger {
		background: #dc2626;
		color: white;
	}
</style>
