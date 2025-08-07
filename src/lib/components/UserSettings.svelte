<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import OrganizationSettings from '$lib/components/OrganizationSettings.svelte';
	import UserNameForm from '$lib/components/UserNameForm.svelte';
	import UserAvatarForm from '$lib/components/UserAvatarForm.svelte';
	import Modal from '../../components/Modal.svelte';

	type Org = {
		id: string;
		name: string;
		slug: string;
		logo_url?: string | null;
		primary_color?: string;
		secondary_color?: string;
		accent_color?: string;
	};
	type OrgWithRole = {
		organization: Org;
		role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'MEMBER' | 'VIEWER' | null;
	};

	let loading = true;
	let error: string | null = null;
	let items: { id: string; name: string; slug: string; role: OrgWithRole['role'] }[] = [];

	let selected: Org | null = null;
	let selectedRole: OrgWithRole['role'] = null;
	let open = false;
	// Load full org details on open as required
	$: if (open && selected) {
		(async () => {
			try {
				const r = await fetch(`/api/organizations/${selected.slug}`);
				if (r.ok) {
					const data = await r.json();
					selected = {
						id: data.organization.id,
						name: data.organization.name,
						slug: data.organization.slug,
						logo_url: data.organization.logo_url,
						primary_color: data.organization.primary_color,
						secondary_color: data.organization.secondary_color,
						accent_color: data.organization.accent_color
					};
					selectedRole = data.role;
				}
			} catch (e) {
				// ignore, still show basic view
			}
		})();
	}

	async function fetchOrganizations(): Promise<{ id: string; name: string; slug: string }[]> {
		const res = await fetch('/api/organizations');
		if (!res.ok) throw new Error((await res.json()).error || 'Failed to load organizations');
		return (await res.json()).organizations ?? [];
	}

	async function loadOrgs() {
		loading = true;
		error = null;
		try {
			const orgs = await fetchOrganizations();
			// Fetch role per org via detail endpoint; batch sequentially to keep simple
			const results: { id: string; name: string; slug: string; role: OrgWithRole['role'] }[] = [];
			for (const org of orgs) {
				try {
					const r = await fetch(`/api/organizations/${org.slug}`);
					if (!r.ok) throw new Error((await r.json()).error || 'Failed to load org');
					const data = await r.json();
					results.push({
						id: data.organization.id,
						name: data.organization.name,
						slug: data.organization.slug,
						role: data.role
					});
				} catch (e) {
					results.push({ id: org.id, name: org.name, slug: org.slug, role: null });
				}
			}
			items = results;
		} catch (e: any) {
			error = e.message ?? 'Failed to load organizations';
		} finally {
			loading = false;
		}
	}
	$: console.log({ items });
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

	// Refresh item from API detail after closing
	async function refreshSelected() {
		if (!selected) return;
		try {
			const r = await fetch(`/api/organizations/${selected.slug}`);
			if (!r.ok) return;
			const data = await r.json();
			const idx = items.findIndex((i) => i.slug === selected!.slug);
			if (idx >= 0) {
				items[idx] = {
					id: data.organization.id,
					name: data.organization.name,
					slug: data.organization.slug,
					role: data.role
				};
			}
		} catch {}
	}

	$: if (!open) {
		// When modal closes, refresh list to reflect any changes
		refreshSelected();
	}

	onMount(loadOrgs);
</script>

<section class="container">
	<header class="mb-2">
		<h1 class="mb-1">Settings</h1>
		{#if $page.data.organizationContext}
			<p>
				Current organization: <strong>{$page.data.organizationContext.organization.name}</strong>
				({$page.data.organizationContext.organization.slug})
			</p>
		{/if}
	</header>
	<UserNameForm />
	<UserAvatarForm />

	{#if loading}
		<div class="card loading">Loading organizations…</div>
	{:else if error}
		<div class="card error">{error}</div>
	{:else if items.length === 0}
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

	{#if selected}
		<Modal bind:open title="Edit Organization" size="lg">
			{#if open}
				<OrganizationSettings organization={selected as any} role={selectedRole} />
			{/if}
		</Modal>
	{/if}
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
