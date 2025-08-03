<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { AuthService } from '$lib/auth';
	import { browser } from '$app/environment';
	let user = $state(page.data.user);
	if (browser) {
		AuthService.onAuthStateChange((currentUser) => {
			user = currentUser ?? null;
		});
	}
	async function handleSignOut() {
		try {
			await fetch('/auth', { method: 'POST', body: new FormData() });
			user = null;
			goto('/auth');
		} catch (error) {
			console.error('Sign out error:', error);
		}
	}
</script>

<nav class="navbar">
	<div class="nav-container">
		<a href="/" class="nav-brand">CampVotr</a>

		<div class="nav-links">
			{#if user}
				<a href="/dashboard" class="nav-link" class:active={page.url.pathname === '/dashboard'}>
					Dashboard
				</a>
				<a href="/ballots" class="nav-link" class:active={page.url.pathname.startsWith('/ballots')}>
					Ballots
				</a>
				<a
					href="/voter-lists"
					class="nav-link"
					class:active={page.url.pathname.startsWith('/voter-lists')}
				>
					Voter Lists
				</a>
				<a
					href="/notifications"
					class="nav-link"
					class:active={page.url.pathname === '/notifications'}
				>
					Notifications
				</a>
				<div class="user-menu">
					<span class="user-email">{user.email}</span>
					<button on:click={handleSignOut} class="sign-out-btn"> Sign Out </button>
				</div>
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
		color: #007bff;
		text-decoration: none;
	}

	.nav-brand:hover {
		color: #0056b3;
	}

	.nav-links {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.nav-link {
		color: #666;
		text-decoration: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.nav-link:hover {
		color: #007bff;
		background: #f8f9fa;
	}

	.nav-link.active {
		color: #007bff;
		background: #e3f2fd;
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
			margin-top: 1rem;
			flex-wrap: wrap;
			justify-content: center;
		}

		.user-menu {
			margin-left: 0;
			padding-left: 0;
			border-left: none;
			border-top: 1px solid #e0e0e0;
			padding-top: 1rem;
			margin-top: 1rem;
		}

		.user-email {
			display: none;
		}
	}
</style>
