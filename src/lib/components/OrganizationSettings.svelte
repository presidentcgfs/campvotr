<script lang="ts">
	import { applyTheme, normalizeHexColor, validateHexColor } from '$lib/utils/theme';
	import { onMount } from 'svelte';
	import OrganizationMembers from './OrganizationMembers.svelte';
	import OrgTieBreakerSelector from './OrgTieBreakerSelector.svelte';
	import Button from './Button.svelte';

	export let organization: {
		id: string;
		name: string;
		slug: string;
		logo_url: string | null;
		primary_color: string;
		secondary_color: string;
		accent_color: string;
	};
	export let role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'MEMBER' | 'VIEWER' | null;

	let logoFile: File | null = null;
	let error = '';

	let primary = organization?.primary_color ?? '#2563eb';
	let secondary = organization?.secondary_color ?? '#64748b';
	let accent = organization?.accent_color ?? '#22c55e';

	let domainInput: string | null = null;
	let success = '';

	onMount(() => {
		// Initialize form values from incoming org
		domainInput = (organization as any).primary_domain ?? null;
		applyTheme({ primaryColor: primary, secondaryColor: secondary, accentColor: accent });
	});

	$: if (primary && secondary && accent) {
		applyTheme({ primaryColor: primary, secondaryColor: secondary, accentColor: accent });
	}

	function colorValid(c: string) {
		return validateHexColor(c);
	}

	async function uploadLogo() {
		error = '';
		try {
			if (!logoFile) return;
			if (logoFile.size > 2 * 1024 * 1024) throw new Error('Logo must be 2MB or less');
			if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(logoFile.type)) {
				throw new Error('Logo must be PNG, JPG, or SVG');
			}
			const body = new FormData();
			body.set('file', logoFile);
			const res = await fetch(`/api/organizations/${organization.slug}/logo`, {
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
		error = '';
		try {
			if (![primary, secondary, accent].every(colorValid)) throw new Error('Invalid color');
			const res = await fetch(`/api/organizations/${organization.slug}`, {
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

<div class="settings">
	<div class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'branding'}
			on:click={() => (activeTab = 'branding')}>Branding</button
		>
		<button
			class="tab"
			class:active={activeTab === 'members'}
			on:click={() => (activeTab = 'members')}>Members</button
		>
	</div>
	{#if activeTab === 'members'}
		<div class="section">
			<OrganizationMembers {organization} {role} />
			{#if role === 'OWNER' || role === 'ADMIN'}
				<hr />
				<OrgTieBreakerSelector orgSlug={organization.slug} canEdit={true} />
			{/if}
		</div>
	{/if}
</div>

{#if activeTab === 'branding'}
	<section class="branding">
		<div class="row">
			<div>
				<label for="logo-input">Logo</label>
				{#if organization.logo_url}
					<img src={organization.logo_url} alt="Logo" class="logo" />
				{/if}
				<input
					id="logo-input"
					type="file"
					accept="image/png,image/jpeg,image/svg+xml"
					on:change={(e) => (logoFile = (e.target as HTMLInputElement).files?.[0] ?? null)}
				/>
				<Button
					on:click={uploadLogo}
					disabled={!logoFile || !(role === 'OWNER' || role === 'ADMIN')}>Upload</Button
				>
			</div>
			<label for="primary-domain">Primary domain</label>
			<input
				id="primary-domain"
				type="text"
				placeholder="example.org"
				bind:value={domainInput}
				readonly={!(role === 'OWNER' || role === 'ADMIN')}
			/>
			<small
				>Used to select this organization when visiting this hostname. Do not include http/https,
				paths, or ports.</small
			>

			<div class="colors">
				<label for="primary-color"
					><span class="hidden sm:inline">Primary Color</span>
					<input id="primary-color" type="color" bind:value={primary} />
				</label>
				<label for="secondary-color">
					<span class="hidden sm:inline">Secondary Color</span>
					<input id="secondary-color" type="color" bind:value={secondary} />
				</label>
				<label for="accent-color"
					><span class="hidden sm:inline">Accent Color</span>
					<input id="accent-color" type="color" bind:value={accent} />
				</label>
				<div
					class="preview"
					style="--primary-color: {primary}; --secondary-color: {secondary}; --accent-color: {accent}"
				>
					<Button>Primary Button</Button>
					<Button variant="tertiary" href="/">Link</Button>
					<Button variant="secondary">Secondary Button</Button>
				</div>
				<Button on:click={saveBranding} disabled={!(role === 'OWNER' || role === 'ADMIN')}
					>Save</Button
				>
			</div>
		</div>
		{#if error}
			<p class="error">{error}</p>
		{/if}
	</section>
{/if}

<style>
	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}
	.tab {
		background: #eee;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
	}
	.tab.active {
		background: var(--color-secondary);
		color: white;
	}
	.row {
		display: grid;
		grid-template-columns: 220px 1fr;
		gap: 1rem;
	}
	.logo {
		max-width: 200px;
		max-height: 120px;
		display: block;
		margin-bottom: 0.5rem;
	}
	.colors {
		@apply flex flex-col gap-4 rounded-lg border p-4;
	}
	.colors label {
		display: block;
		font-weight: 600;
		margin-top: 0.75rem;
	}
	.colors input {
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
	}
	.colors input.invalid {
		border-color: #dc2626;
	}
	.preview {
		margin-top: 1rem;
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.error {
		color: #dc2626;
	}
	.sample {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border-radius: 9999px;
	}
	.branding input[type='color'] {
		width: 20px;
		height: 20px;
		padding: 0;
		border: none;
		border-radius: 50%;
	}
</style>
