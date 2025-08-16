<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import OrganizationSettings from '$lib/components/OrganizationSettings.svelte';
	import UserNameForm from '$lib/components/UserNameForm.svelte';
	import UserAvatarForm from '$lib/components/UserAvatarForm.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import Button from './Button.svelte';
	import type { Organization } from '../../model.types';

	type OrgWithRole = {
		organization: Organization;
		role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'MEMBER' | 'VIEWER' | null;
	};

	let error: string | null = null;
	export let items: { id: string; name: string; slug: string; role: OrgWithRole['role'] }[] = [];
	export let selected: Pick<
		Organization,
		'id' | 'name' | 'slug' | 'logo_url' | 'primary_color' | 'secondary_color' | 'accent_color'
	> | null = null;
	export let selectedRole: OrgWithRole['role'] = null;
	let open = false;
	// Load full org details on open as required

	function editOrg(slug: string) {
		const row = items.find((i) => i.slug === slug);
		if (!row) return;
		selected = {
			id: row.id,
			name: row.name,
			slug: row.slug,
			logo_url: null,
			primary_color: '#2563eb',
			secondary_color: '#64748b',
			accent_color: '#22c55e'
		};
		selectedRole = row.role;
		open = true;
	}

	async function handleSignOut() {
		try {
			await fetch('/api/auth/signout', { method: 'POST', body: new FormData() });
			goto('/');
		} catch (error) {
			console.error('Sign out error:', error);
		}
	}
</script>

<section class="container">
	<header class="mb-2 flex flex-1 justify-between">
		<h1 class="mb-1">Settings</h1>
		{#if $page.data.organizationContext}
			<p>
				Current organization: <strong>{$page.data.organizationContext.organization.name}</strong>
				({$page.data.organizationContext.organization.slug})
			</p>
		{/if}
		<Button onclick={handleSignOut} variant="secondary">Sign Out</Button>
	</header>
	<UserNameForm />
	<UserAvatarForm />

	{#if items.length === 0}
		<div class="card">You don't belong to any organizations yet.</div>
	{:else}
		<div class="card">
			<div class="responsive-table">
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Slug</th>
							<th>Your role</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each items as it}
							<tr>
								<td>{it.name}</td>
								<td>{it.slug}</td>
								<td>{it.role ?? '—'}</td>
								<td style="text-align:right">
									{#if it.role === 'OWNER' || it.role === 'ADMIN'}
										<button class="btn" on:click={() => editOrg(it.slug)}>Edit</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<OrganizationSettings bind:open organizationId={selected?.id} role={selectedRole} />
</section>

<style>
	.responsive-table {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		text-align: left;
	}
	th {
		background: #f8fafc;
	}

	@media (max-width: 640px) {
		th,
		td {
			font-size: 0.95rem;
		}
	}
</style>
