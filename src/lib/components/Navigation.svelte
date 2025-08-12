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
	.navbar {
		background: #fff;
		border-bottom: 1px solid #e0e0e0;
		padding: 0 1rem;
		position: sticky;
		top: 0;
		z-index: 100;
	}

	.nav-container {
		max-width: 1200px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.nav-brand {
		font-size: 1.5rem;
		font-weight: bold;
		color: var(--color-primary);
		text-decoration: none;
	}

	.nav-links {
		@apply block w-full flex-1 flex-grow lg:flex lg:w-auto lg:items-center;
	}
	.user-menu {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-left: 1rem;
		padding-left: 1rem;
		border-left: 1px solid #e0e0e0;
	}

	.user-email {
		color: #666;
		font-size: 0.9rem;
	}

	@media (max-width: 768px) {
		.nav-container {
			flex-direction: column;
			height: auto;
			padding: 1rem 0;
		}
	}
</style>
