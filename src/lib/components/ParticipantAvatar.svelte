<script lang="ts">
	import type { DrawParticipant } from '$lib/db/zod';
	import {
		getContrastTextColor,
		stringToTailwindBg,
		stringToVibrantColor
	} from '$lib/utils/color-utils';
	import { Avatar } from 'flowbite-svelte';
	import Button from './Button.svelte';
	import { UserRemoveOutline } from 'flowbite-svelte-icons';

	let {
		onClick,
		participant = { id: '', email: '' },
		size = 'sm',
		showName = true,
		canRemove = false
	} = $props<{
		participant: DrawParticipant;
		size?: 'sm' | 'md' | 'lg';
		onClick?: (participant: DrawParticipant) => void;
		canRemove?: boolean;
	}>();

	let ele = onClick && !canRemove ? 'button' : 'div';
	let _name = $derived(participant.displayName || participant.email);

	function getAvatarSrc(name: string): string {
		const bgColor = stringToVibrantColor(_name).replace('#', '');
		const textColor = getContrastTextColor(`#${bgColor}`).replace('#', '');
		return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bgColor}&color=${textColor}`;
	}
	let src = $derived(participant.avatarUrl || getAvatarSrc(_name));
	let bgColor = $derived(stringToTailwindBg(participant.displayName || participant.email));
	let color = $derived(getContrastTextColor(bgColor));
</script>

{#snippet name(participant: DrawParticipant)}
	<div class="flex min-w-0 flex-1 gap-1">
		{#if participant.displayName}
			<div class="truncate font-medium text-gray-900">
				{participant.displayName}
			</div>
		{/if}
		{#if participant.displayName !== participant.email}
			<div class="truncate text-sm text-gray-500">
				{participant.email}
			</div>
		{/if}
	</div>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:element
	this={ele}
	class="flex items-center gap-3"
	onclick={() => onClick(participant)}
	class:can-remove={canRemove}
>
	<span style:color style:display="contents" class="avatar-stack">
		{#if canRemove}
			<Button
				size="sm"
				pill
				color="red"
				onclick={() => onClick(participant)}
				aria-label="Clear selection"
				class="avatar-area "
			>
				<UserRemoveOutline size="sm" />
			</Button>
		{/if}
		<Avatar
			{src}
			alt={participant.displayName || participant.email}
			{size}
			class="border border-gray-200 {color} {bgColor}"
		/>
	</span>
	{#if showName}
		{@render name(participant)}
	{/if}
</svelte:element>

<style>
	.avatar-stack {
		display: grid;
	}
	.avatar-stack {
		& > :global(*) {
			grid-area: avatar;
		}
		& > :global(button) {
			visibility: hidden;
		}
	}
	.can-remove .avatar-stack:hover {
		& > :global(button) {
			visibility: visible;
		}
		& > :global(img) {
			visibility: hidden;
		}
	}
</style>
