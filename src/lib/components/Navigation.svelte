<script lang="ts">
	import { page } from '$app/state';
	import { AuthService } from '$lib/auth';
	import { browser } from '$app/environment';
	import Button from './Button.svelte';

	let user = $state(page.data.user);
	if (browser) {
		AuthService.onAuthStateChange((currentUser) => {
			user = currentUser ?? null;
		});
	}
</script>

<nav class="flex w-full flex-wrap items-center justify-between border-b p-6">
	<div class="mr-6 flex flex-1 flex-shrink-0 items-center text-white">
		<div class="block w-full flex-grow items-center gap-1 lg:flex lg:w-auto">
			<a href="/dashboard" class="nav-brand"
				>{page.data.organizationContext?.organization.name ?? 'CampVotr'}</a
			>
		</div>
		<div class="user-menu">
			{#if user}
				<Button href="/settings" class={page.url.pathname.startsWith('/settings') && 'active'}
					>{user.email}</Button
				>
			{:else}
				<Button href="/auth">Sign In</Button>
			{/if}
		</div>
	</div>
</nav>

<style>
	.nav-brand {
		font-size: 1.5rem;
		font-weight: bold;
		color: var(--color-primary);
		text-decoration: none;
	}
	.user-menu {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-left: 1rem;
		padding-left: 1rem;
		border-left: 1px solid #e0e0e0;
	}
</style>
