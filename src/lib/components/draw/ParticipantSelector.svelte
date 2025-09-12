<script lang="ts">
	import { Avatar, Input, Button, P } from 'flowbite-svelte';
	import { ChevronDownOutline, UserRemoveOutline } from 'flowbite-svelte-icons';
	import type { DrawParticipant } from '$lib/types/draw-session';
	import { stringToVibrantColor, getContrastTextColor, getInitials } from '$lib/utils/color-utils';
	import ParticipantAvatar from '../ParticipantAvatar.svelte';

	interface Props {
		participants: DrawParticipant[];
		selectedParticipantId?: string | null;
		placeholder?: string;
		disabled?: boolean;
		onSelect: (participantId: string | null) => void;
		ariaLabel?: string;
	}

	let {
		participants = $bindable([]),
		selectedParticipantId = null,
		placeholder = 'Select participant...',
		disabled = false,
		onSelect,
		ariaLabel
	}: Props = $props();

	// Local state for search and dropdown
	let searchTerm = $state('');
	let isOpen = $state(false);
	let inputRef = $state() as HTMLInputElement;

	// Derived filtered participants
	const filteredParticipants = $derived.by(() => {
		if (!searchTerm.trim()) return participants.slice(0, 20) ?? [];
		const term = searchTerm.toLowerCase();
		return participants
			.filter(
				(p) => p.displayName?.toLowerCase().includes(term) || p.email?.toLowerCase().includes(term)
			)
			.slice(0, 20);
	});

	// Selected participant object
	const selectedParticipant = $derived.by(() => {
		if (!selectedParticipantId) return null;
		return participants.find((p) => p.id === selectedParticipantId) || null;
	});

	// Display text for the input
	const displayText = $derived.by(() => {
		if (selectedParticipant) {
			return selectedParticipant.displayName;
		}
		return searchTerm || placeholder;
	});

	function handleInputFocus() {
		if (!disabled) {
			isOpen = true;
			searchTerm = '';
		}
	}

	function handleInputBlur() {
		// Delay closing to allow for clicks on dropdown items
		setTimeout(() => {
			if (!isOpen) return;
			isOpen = false;
			// Reset search term if no selection was made
			if (!selectedParticipant) {
				searchTerm = '';
			}
		}, 150);
	}

	function handleClear() {
		selectedParticipantId = null;
		searchTerm = '';
		isOpen = false;
		inputRef?.focus();
		onSelect(null);
	}
</script>

<div class="participant-selector relative">
	<!-- Input field -->
	<div class="relative">
		<!-- Selected participant avatar in input -->
		{#if selectedParticipant && !isOpen}
			<ParticipantAvatar
				participant={selectedParticipant}
				size="sm"
				canRemove
				onClick={handleClear}
			/>
		{:else}
			<Input
				bind:elementRef={inputRef}
				bind:value={searchTerm}
				placeholder={displayText}
				size="sm"
				{disabled}
				aria-label={ariaLabel}
				onfocus={handleInputFocus}
				onblur={handleInputBlur}
				class="w-full pr-20"
			/>

			<!-- Action buttons -->
			<div class="absolute inset-y-0 right-0 flex items-center pr-3">
				<ChevronDownOutline class="h-4 w-4 text-gray-400" />
			</div>
		{/if}
	</div>

	<!-- Dropdown -->
	{#if isOpen && !disabled}
		<div class=" z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg bg-white shadow-lg">
			{#if filteredParticipants.length === 0}
				<div class="px-4 py-3 text-center text-sm text-gray-500">
					{searchTerm ? 'No participants found' : 'No participants available'}
				</div>
			{/if}
		</div>
		<div
			class="cursor-hand absolute
			top-full
			z-50
			mt-1
			flex
			max-h-60
			w-full
			flex-col gap-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
		>
			{#each filteredParticipants as participant (participant?.id)}
				<ParticipantAvatar {participant} size="sm" onClick={() => onSelect(participant.id)} />
			{/each}
		</div>
	{/if}
</div>

<style>
	/* .participant-selector {
		max-height: 2rem;
		min-height: 2rem;
	} */
</style>
