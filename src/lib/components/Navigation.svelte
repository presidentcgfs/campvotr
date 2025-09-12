<script lang="ts">
	import { page } from '$app/state';

	import {
		Navbar,
		NavBrand,
		NavLi,
		NavUl,
		NavHamburger,
		Avatar,
		Dropdown,
		DropdownItem,
		DropdownGroup,
		DropdownDivider,
		DropdownHeader
	} from 'flowbite-svelte';
	import type { Organization } from '../../model.types';
	import type { User } from '@supabase/supabase-js';
	import { AuthService } from '$lib/auth';
	import { goto } from '$app/navigation';

	let { user, organization } = $props<{ user?: User; organization?: Organization }>();

	// Handle logout
	async function handleLogout() {
		try {
			await AuthService.signOut();
			goto('/');
		} catch (error) {
			console.error('Logout failed:', error);
		}
	}

	// Get avatar URL from user metadata (Google OAuth or uploaded image)
	function getAvatarUrl(user: User): string | null {
		// Check user metadata for avatar_url (from Google OAuth or uploaded image)
		const avatarUrl = user.user_metadata?.avatar_url;
		if (avatarUrl && typeof avatarUrl === 'string') {
			return avatarUrl;
		}
		return null;
	}

	// Generate user initials from email as fallback
	function getUserInitials(email: string): string {
		if (!email) return 'U';

		// Try to get name from email (before @)
		const namePart = email.split('@')[0];

		// Split by common separators and take first letter of each part
		const parts = namePart.split(/[._-]/).filter((part) => part.length > 0);

		if (parts.length >= 2) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		} else if (parts.length === 1) {
			return parts[0].substring(0, 2).toUpperCase();
		}

		return 'U';
	}
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
				{@const avatarUrl = getAvatarUrl(user)}
				<li class="relative">
					<button
						class="flex cursor-pointer items-center rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
						id="user-menu-button"
					>
						{#if avatarUrl}
							<Avatar size="sm" src={avatarUrl} alt="User avatar" />
						{:else}
							<Avatar size="sm">
								{getUserInitials(user.email || '')}
							</Avatar>
						{/if}
					</button>
					<Dropdown triggeredBy="#user-menu-button" class="w-48">
						<DropdownGroup>
							<DropdownHeader>
								<span class="block overflow-hidden text-sm text-ellipsis whitespace-nowrap"
									>{user.user_metadata?.display_name ||
										user.user_metadata?.full_name ||
										getUserInitials(user.email || '')}</span
								>
								<span class="block truncate text-sm font-medium">{user.email}</span>
							</DropdownHeader>
							<DropdownItem href="/admin/draw-sessions" class="flex items-center">
								<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
									></path>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									></path>
								</svg>
								Draws
							</DropdownItem>
							<DropdownItem href="/settings" class="flex items-center">
								<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
									></path>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
									></path>
								</svg>
								Settings
							</DropdownItem>
							<DropdownItem href="/settings/organization" class="flex items-center">
								<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h4M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
									></path>
								</svg>
								Organization
							</DropdownItem>
						</DropdownGroup>
						<DropdownGroup>
							<DropdownItem
								onclick={handleLogout}
								class="flex flex-1 items-center text-red-600 hover:text-red-700"
							>
								<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
									></path>
								</svg>
								Logout
							</DropdownItem>
						</DropdownGroup>
					</Dropdown>
				</li>
			{:else}
				<NavLi href="/auth">Sign In</NavLi>
			{/if}
		</NavUl>
	</Navbar>
</header>
