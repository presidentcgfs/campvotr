<script lang="ts">
	import { page } from '$app/state';
	import { AuthService } from '$lib/auth';
	import { browser } from '$app/environment';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';

	let user = $state(page.data.user);
	if (browser) {
		AuthService.onAuthStateChange((currentUser) => {
			user = currentUser ?? null;
		});
	}
</script>

<header>
	<Navbar>
		<NavBrand href="/">
			{page.data.organizationContext?.organization.name ?? 'CampVotr'}
		</NavBrand>

		<NavUl>
			{#if user}
				<NavLi href="/settings">{user.email}</NavLi>
			{:else}
				<NavLi href="/auth">Sign In</NavLi>
			{/if}
		</NavUl>
	</Navbar>
</header>
