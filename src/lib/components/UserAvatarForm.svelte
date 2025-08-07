<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from './Modal.svelte';

	let avatar_url: string | null = null;
	let file: File | null = null;
	let loading = true;
	let saving = false;
	let removing = false;
	let error = '';
	let success = '';
	let confirmOpen = false;

	onMount(async () => {
		await loadProfile();
	});

	async function loadProfile() {
		loading = true;
		error = '';
		try {
			const res = await fetch('/api/users/me');
			if (!res.ok) throw await mapError(res);
			const data = await res.json();
			avatar_url = data.avatar_url ?? null;
		} catch (e: any) {
			error = e.message ?? 'Failed to load profile';
		} finally {
			loading = false;
		}
	}

	function validateFile(f: File): string | null {
		const okTypes = ['image/png', 'image/jpeg', 'image/webp'];
		if (!okTypes.includes(f.type)) return 'Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.';
		if (f.size > 2 * 1024 * 1024) return 'Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.';
		return null;
	}

	async function upload() {
		error = '';
		success = '';
		if (!file) {
			error = 'Please choose a file.';
			return;
		}
		const v = validateFile(file);
		if (v) {
			error = v;
			return;
		}
		saving = true;
		try {
			const fd = new FormData();
			fd.set('file', file);
			const res = await fetch('/api/users/me/avatar', { method: 'POST', body: fd });
			if (!res.ok) throw await mapError(res);
			const data = await res.json();
			avatar_url = data.avatar_url;
			file = null;
			success = 'Saved';
			setTimeout(() => (success = ''), 2000);
		} catch (e: any) {
			error = e.message ?? 'Request failed. Try again.';
		} finally {
			saving = false;
		}
	}

	function askRemove() {
		confirmOpen = true;
	}

	async function removeAvatar() {
		removing = true;
		error = '';
		success = '';
		try {
			const res = await fetch('/api/users/me/avatar', { method: 'DELETE' });
			if (!res.ok) throw await mapError(res);
			avatar_url = null;
			success = 'Removed';
			setTimeout(() => (success = ''), 2000);
		} catch (e: any) {
			error = e.message ?? 'Request failed. Try again.';
		} finally {
			removing = false;
			confirmOpen = false;
		}
	}

	async function mapError(res: Response) {
		const body = await safeJson(res);
		if (res.status === 401) return new Error('You must be signed in to update your avatar.');
		if (res.status === 403) return new Error('You don’t have permission to update this profile.');
		if (res.status === 404) return new Error('User not found.');
		if (res.status === 429) return new Error('Too many requests. Try again soon.');
		if (res.status === 409 || res.status === 422)
			return new Error(body?.error || 'Invalid image. Please upload a PNG/JPG/WEBP up to 2MB.');
		return new Error(body?.error || 'Request failed. Try again.');
	}
	async function safeJson(res: Response) {
		try {
			return await res.json();
		} catch {
			return null;
		}
	}
</script>

<section class="card">
	<h2>Avatar</h2>
	{#if loading}
		<p>Loading…</p>
	{:else}
		<div class="row">
			<div class="preview">
				{#if avatar_url}
					<img src={avatar_url} alt="Your avatar" class="avatar" />
				{:else}
					<div class="avatar placeholder" aria-label="No avatar">?</div>
				{/if}
			</div>
			<div class="controls">
				<label for="avatar-file">Choose file</label>
				<input
					id="avatar-file"
					type="file"
					accept="image/png,image/jpeg,image/webp"
					on:change={(e) => (file = (e.target as HTMLInputElement).files?.[0] ?? null)}
					disabled={saving || removing}
				/>
				<div class="actions">
					<button class="btn" on:click={upload} disabled={saving || removing || !file}
						>Upload</button
					>
					<button class="btn" on:click={askRemove} disabled={saving || removing || !avatar_url}
						>Remove</button
					>
				</div>
				{#if error}<p class="error" aria-live="polite">{error}</p>{/if}
				{#if success}<p class="success" aria-live="polite">{success}</p>{/if}
			</div>
		</div>
	{/if}

	<Modal bind:open={confirmOpen} title="Remove avatar" role="alertdialog">
		<p>Are you sure you want to remove your avatar?</p>
		<div slot="footer">
			<button class="btn" on:click={() => (confirmOpen = false)}>Cancel</button>
			<button class="btn danger" on:click={removeAvatar}>Remove</button>
		</div>
	</Modal>
</section>

<style>
	.row {
		display: grid;
		gap: 1rem;
		grid-template-columns: 110px 1fr;
		align-items: center;
	}
	.avatar {
		width: 96px;
		height: 96px;
		border-radius: 9999px;
		object-fit: cover;
		border: 1px solid #e5e7eb;
	}
	.avatar.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f3f4f6;
		color: #6b7280;
		font-weight: 600;
		font-size: 24px;
	}
	.controls label {
		display: block;
		font-weight: 600;
		margin-bottom: 0.25rem;
	}
	.actions {
		margin-top: 0.5rem;
		display: flex;
		gap: 0.5rem;
	}
	.error {
		color: #dc2626;
	}
	.success {
		color: #16a34a;
	}
	.btn.danger {
		background: #dc2626;
		color: white;
	}
</style>
