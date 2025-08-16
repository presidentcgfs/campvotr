<script lang="ts">
	import { applyTheme, normalizeHexColor, validateHexColor } from '$lib/utils/theme';
	import { onMount } from 'svelte';
	import OrganizationMembers from './OrganizationMembers.svelte';
	import OrgTieBreakerSelector from './OrgTieBreakerSelector.svelte';
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';
	import type { Organization } from '../../model.types';

	export let organizationId: string | undefined = undefined;
	export let role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'MEMBER' | 'VIEWER' | null;
	export let open = false;

	let error = '';
	let organization: Organization | undefined = undefined;

	$: primary = organization?.primary_color ?? '#2563eb';
	$: secondary = organization?.secondary_color ?? '#64748b';
	$: accent = organization?.accent_color ?? '#22c55e';
	$: domainInput = organization?.primary_domain;

	let success = '';
	let loading = false;
	async function loadOrganization(orgId?: string) {
		if (loading || !orgId || organization?.id === orgId) return;
		loading = true;
		const resp = await (await fetch(`/api/organizations/${organizationId}`)).json();
		organization = resp.organization;
		role = resp.role;
		loading = false;
	}
	$: mounted && loadOrganization(organizationId);

	$: mounted = false;
	onMount(() => {
		mounted = true;
		// Initialize form values from incoming org
		applyTheme({ primaryColor: primary, secondaryColor: secondary, accentColor: accent });
	});

	$: if (primary && secondary && accent && mounted) {
		applyTheme({ primaryColor: primary, secondaryColor: secondary, accentColor: accent });
	}

	async function uploadLogo(logoFile: File) {
		if (!organization) return;

		error = '';
		try {
			if (!logoFile) return;
			if (logoFile.size > 2 * 1024 * 1024) throw new Error('Logo must be 2MB or less');
			if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(logoFile.type)) {
				throw new Error('Logo must be PNG, JPG, or SVG');
			}
			const body = new FormData();
			body.set('file', logoFile);
			const res = await fetch(`/api/organizations/${organization.id}/logo`, {
				method: 'POST',
				body
			});
			if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');
			const data = await res.json();
			organization.logo_url = data.logoUrl;
		} catch (e: any) {
			error = e.message ?? 'Upload failed';
		}
	}

	async function saveBranding() {
		if (!organization) return;
		error = '';
		try {
			if (![primary, secondary, accent].every(validateHexColor)) throw new Error('Invalid color');
			const res = await fetch(`/api/organizations/${organization.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: organization.name,
					theme: {
						primaryColor: normalizeHexColor(primary),
						secondaryColor: normalizeHexColor(secondary),
						accentColor: normalizeHexColor(accent)
					},
					domain: domainInput
				})
			});
			if (!res.ok) {
				const e = await res.json();
				if (res.status === 401 || res.status === 403)
					throw new Error('You don’t have permission to update this organization.');
				if (res.status === 404) throw new Error('Organization not found.');
				if (res.status === 409 || res.status === 422)
					throw new Error(
						'Invalid or duplicate domain. Use a hostname like example.org (no http/https, paths, or ports).'
					);
				throw new Error(e.error || 'Save failed');
			}
			const data = await res.json();
			organization = data.organization;
			success = 'Saved';
			setTimeout(() => (success = ''), 2000);
		} catch (e: any) {
			error = e.message ?? 'Save failed';
		}
	}
	let activeTab: 'branding' | 'members' = 'branding';
	$: activeTab = 'branding';
</script>

<Modal bind:open title="Organization Settings" size="lg">
	<div class="mb-4 flex gap-2">
		<Button
			class={activeTab === 'branding'
				? 'active inline-block rounded-lg bg-blue-600 px-4 py-3 text-white'
				: 'inline-block rounded-lg px-4 py-3 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white'}
			onclick={() => (activeTab = 'branding')}>Branding</Button
		>
		<Button
			class={activeTab === 'members'
				? 'active inline-block rounded-lg bg-blue-600 px-4 py-3 text-white'
				: 'inline-block rounded-lg px-4 py-3 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white'}
			onclick={() => (activeTab = 'members')}>Members</Button
		>
	</div>
	{#if activeTab === 'members' && organization}
		<div>
			<OrganizationMembers {organization} {role} />
			{#if role === 'OWNER' || role === 'ADMIN'}
				<hr class="my-4" />
				<OrgTieBreakerSelector orgId={organizationId!} canEdit={true} />
			{/if}
		</div>
	{:else if activeTab === 'branding'}
		<section>
			<div class="grid grid-cols-[220px_1fr] gap-4">
				<div class="col-span-2">
					<label for="logo-input" class="mb-2 block font-semibold">Logo</label>
					{#if organization?.logo_url}
						<img
							src={organization.logo_url}
							alt="Logo"
							class="mb-2 block max-h-[120px] max-w-[200px]"
						/>
					{/if}
					<input
						id="logo-input"
						type="file"
						accept="image/png,image/jpeg,image/svg+xml"
						class="mb-2"
						onchange={(e) => uploadLogo((e.target as any)?.files?.[0])}
					/>
				</div>

				<label for="primary-domain" class="font-semibold">Primary domain</label>
				<div>
					<input
						id="primary-domain"
						type="text"
						placeholder="example.org"
						bind:value={domainInput}
						readonly={!(role === 'OWNER' || role === 'ADMIN')}
						class="focus:ring-primary w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2"
					/>
					<small class="mt-1 block text-sm text-gray-600"
						>Used to select this organization when visiting this hostname. Do not include
						http/https, paths, or ports.</small
					>
				</div>

				<div class="col-span-2 flex flex-col gap-4 rounded-lg border p-4">
					<label for="primary-color" class="block font-semibold"
						><span class="hidden sm:inline">Primary Color</span>
						<input
							id="primary-color"
							type="color"
							bind:value={primary}
							class="ml-2 h-5 w-5 cursor-pointer rounded-full border-0 p-0"
						/>
					</label>
					<label for="secondary-color" class="block font-semibold">
						<span class="hidden sm:inline">Secondary Color</span>
						<input
							id="secondary-color"
							type="color"
							bind:value={secondary}
							class="ml-2 h-5 w-5 cursor-pointer rounded-full border-0 p-0"
						/>
					</label>
					<label for="accent-color" class="block font-semibold"
						><span class="hidden sm:inline">Accent Color</span>
						<input
							id="accent-color"
							type="color"
							bind:value={accent}
							class="ml-2 h-5 w-5 cursor-pointer rounded-full border-0 p-0"
						/>
					</label>
					<div
						class="mt-4 flex items-center gap-3"
						style="--primary-color: {primary}; --secondary-color: {secondary}; --accent-color: {accent}"
					>
						<Button>Primary Button</Button>
						<Button variant="tertiary" href="/">Link</Button>
						<Button variant="secondary">Secondary Button</Button>
					</div>
				</div>
			</div>
			{#if error}
				<p class="mt-2 text-red-600">{error}</p>
			{/if}
			{#if success}
				<p class="mt-2 text-green-600">{success}</p>
			{/if}
		</section>
	{/if}

	<div slot="footer">
		<Button onclick={saveBranding} disabled={!(role === 'OWNER' || role === 'ADMIN')}>Save</Button>
	</div>
</Modal>
