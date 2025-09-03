<script lang="ts">
	import { page } from '$app/state';

	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
	import type { Organization } from '../../model.types';
	import type { User } from '@supabase/supabase-js';

	let { user, organization } = $props<{ user?: User; organization?: Organization }>();
</script>

<header>
	<Navbar>
		<NavBrand href="/">
			{#if organization?.logoUrl}
				<img src={organization.logoUrl} alt={organization.name + ' logo'} class="h-8" />
			{/if}
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
