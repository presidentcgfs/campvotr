<script lang="ts">
	import { applyTheme, normalizeHexColor, validateHexColor } from '$lib/utils/theme';
	import { onMount } from 'svelte';
	import OrganizationMembers from './OrganizationMembers.svelte';

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
					<button
						class="btn"
						on:click={uploadLogo}
						disabled={!logoFile || !(role === 'OWNER' || role === 'ADMIN')}>Upload</button
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
					<label for="primary-color">Primary Color</label>
					<input
						id="primary-color"
						type="text"
						bind:value={primary}
						class:invalid={!colorValid(primary)}
					/>
					<label for="secondary-color">Secondary Color</label>
					<input
						id="secondary-color"
						type="text"
						bind:value={secondary}
						class:invalid={!colorValid(secondary)}
					/>
					<label for="accent-color">Accent Color</label>
					<input
						id="accent-color"
						type="text"
						bind:value={accent}
						class:invalid={!colorValid(accent)}
					/>
					<div class="preview">
						<button class="btn">Primary Button</button>
						<a href="/">Link</a>
					</div>
					<button
						class="btn save"
						on:click={saveBranding}
						disabled={!(role === 'OWNER' || role === 'ADMIN')}>Save</button
					>
				</div>
			</div>
			{#if error}
				<p class="error">{error}</p>
			{/if}
		</section>
	{:else if activeTab === 'members'}
		<OrganizationMembers {organization} {role} />
	{/if}
</div>

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
	.btn {
		background: var(--button-bg);
		color: var(--button-text);
		border-radius: 6px;
		padding: 0.5rem 0.9rem;
	}
	.btn.save {
		background: var(--color-accent);
	}
	.error {
		color: #dc2626;
	}
</style>
