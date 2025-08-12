<script lang="ts">
	import { page } from '$app/state';
	import { AuthService } from '$lib/auth';
	import { browser } from '$app/environment';

	let user = $state(page.data.user);
	if (browser) {
		AuthService.onAuthStateChange((currentUser) => {
			user = currentUser ?? null;
		});
	}
</script>

<nav class="flex w-full flex-wrap items-center justify-between border-b p-6">
	<div class="mr-6 flex flex-1 flex-shrink-0 items-center text-white">
		<a href="/" class="nav-brand">CampVotr</a>

		<div class="block w-full flex-grow items-center gap-1 lg:flex lg:w-auto">
			{#if user}
				<a href="/dashboard" class:active={page.url.pathname === '/dashboard'}> Dashboard </a>
				<a href="/ballots" class:active={page.url.pathname.startsWith('/ballots')}> Ballots </a>
			{/if}
		</div>
		<div class="user-menu">
			{#if user}
				<a
					href="/settings"
					class="nav-link"
					class:active={page.url.pathname.startsWith('/settings')}>{user.email}</a
				>
			{:else}
				<a href="/auth" class="nav-link">Sign In</a>
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
		height: 60px;
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

	.nav-link {
		@apply mr-4 mt-4 block flex text-teal-200 hover:text-white lg:mt-0 lg:inline-block;
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

	.sign-out-btn {
		background: #dc3545;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.sign-out-btn:hover {
		background: #c82333;
	}

	@media (max-width: 768px) {
		.nav-container {
			flex-direction: column;
			height: auto;
			padding: 1rem 0;
		}

		.nav-links {
			flex-wrap: wrap;
			justify-content: center;
		}
	}
</style>
