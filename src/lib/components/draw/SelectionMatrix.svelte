<script lang="ts">
	import {
		Table,
		TableHead,
		TableHeadCell,
		TableBody,
		TableBodyRow,
		TableBodyCell,
		Input,
		Select,
		Badge,
		Tooltip
	} from 'flowbite-svelte';
	import { SearchOutline } from 'flowbite-svelte-icons';
	import type { DrawParticipant, Field, TimeSlot } from '$lib/types/draw-session';
	import ParticipantAvatar from '../ParticipantAvatar.svelte';

	interface Props {
		participants: DrawParticipant[];
		fields: Field[];
		rounds: number;
		timeSlots: TimeSlot[];
		isAdmin?: boolean;
		onAssignSlot?: (slot: TimeSlot, participantId: string, roundNumber: number) => void;
	}

	let { participants, fields, rounds, timeSlots, isAdmin = false, onAssignSlot }: Props = $props();

	// Local state for filtering
	let searchTerm = $state('');
	let selectedFieldId = $state('');

	// Create field lookup map
	const fieldMap = $derived.by(() => {
		const map = new Map<string, Field>();
		fields.forEach((field) => map.set(field.id, field));
		return map;
	});

	// Create picks lookup map from timeSlots: participantId -> roundNumber -> fieldId
	const picksMap = $derived.by(() => {
		const map = new Map<string, Map<number, string>>();
		timeSlots.forEach((slot) => {
			// Only include slots that are assigned to a participant and have a round number
			if (slot.heldByUserId && slot.roundNumber) {
				if (!map.has(slot.heldByUserId)) {
					map.set(slot.heldByUserId, new Map());
				}
				map.get(slot.heldByUserId)!.set(slot.roundNumber, slot.fieldId);
			}
		});
		return map;
	});

	// Generate round numbers array
	const roundNumbers = $derived.by(() => {
		return Array.from({ length: rounds }, (_, i) => i + 1);
	});

	// Get available slots for selection (not already assigned)
	const availableSlots = $derived.by(() => {
		return timeSlots.filter((slot) => slot.status === 'available' && !slot.heldByUserId);
	});

	// Helper function to format slot description
	function formatSlotDescription(slot: TimeSlot): string {
		const field = fieldMap.get(slot.fieldId);
		const fieldName = field?.name || 'Unknown Field';
		const dayName = slot.weekdayName || 'Unknown Day';
		const timeWindow =
			slot.startTime && slot.endTime ? `${slot.startTime}-${slot.endTime}` : 'Unknown Time';
		return `${dayName} ${timeWindow} - ${fieldName}`;
	}

	// Handle slot assignment
	function handleSlotAssignment(participantId: string, roundNumber: number, slotId: string) {
		const slot = timeSlots.find((s) => s.id === slotId);
		if (slot && onAssignSlot) {
			onAssignSlot(slot, participantId, roundNumber);
		}
	}

	// Filtered participants
	const filteredParticipants = $derived.by(() => {
		let filtered = participants;

		// Filter by search term
		if (searchTerm.trim()) {
			const term = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(p) => p.displayName?.toLowerCase().includes(term) || p.email.toLowerCase().includes(term)
			);
		}

		// Filter by field (show only participants who selected this field in any round)
		if (selectedFieldId) {
			filtered = filtered.filter((p) => {
				const participantPicks = picksMap.get(p.id);
				if (!participantPicks) return false;
				return Array.from(participantPicks.values()).includes(selectedFieldId);
			});
		}

		return filtered;
	});

	function getFieldForParticipantRound(participantId: string, round: number): Field | null {
		const participantPicks = picksMap.get(participantId);
		if (!participantPicks) return null;
		const fieldId = participantPicks.get(round);
		if (!fieldId) return null;
		return fieldMap.get(fieldId) || null;
	}

	function getFieldBadgeColor(
		fieldId: string
	): 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'pink' | 'indigo' {
		// Generate a consistent color based on field ID
		const colors: ('blue' | 'green' | 'red' | 'yellow' | 'purple' | 'pink' | 'indigo')[] = [
			'blue',
			'green',
			'red',
			'yellow',
			'purple',
			'pink',
			'indigo'
		];
		const hash = fieldId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[hash % colors.length];
	}
</script>

<div class="space-y-4">
	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-4">
		<div class="relative min-w-64 flex-1">
			<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
				<SearchOutline class="h-4 w-4 text-gray-500" />
			</div>
			<Input bind:value={searchTerm} placeholder="Search participants..." class="w-full pl-10" />
		</div>
		<div class="min-w-48">
			<Select
				bind:value={selectedFieldId}
				placeholder="All fields"
				items={[
					{ value: '', name: 'All fields' },
					...fields.map((f) => ({ value: f.id, name: f.name }))
				]}
			/>
		</div>
	</div>

	<!-- Matrix Table -->
	<div class="overflow-x-auto rounded-lg border">
		<Table class="min-w-full">
			<TableHead class="sticky top-0 z-10 bg-gray-50">
				<TableHeadCell class="sticky left-0 z-20 min-w-64 bg-gray-50">Participant</TableHeadCell>
				{#each roundNumbers as round}
					<TableHeadCell class="min-w-32 text-center">
						Round {round}
					</TableHeadCell>
				{/each}
			</TableHead>
			<TableBody>
				{#if filteredParticipants.length === 0}
					<TableBodyRow>
						<TableBodyCell colspan={rounds + 1} class="py-8 text-center text-gray-500">
							{searchTerm || selectedFieldId
								? 'No participants match your filters'
								: 'No participants found'}
						</TableBodyCell>
					</TableBodyRow>
				{:else}
					{#each filteredParticipants as participant (participant.id)}
						<TableBodyRow class="hover:bg-gray-50">
							<!-- Participant column (sticky) -->
							<TableBodyCell class="sticky left-0 z-10 min-w-64 bg-white hover:bg-gray-50">
								<div class="flex items-center gap-3">
									<ParticipantAvatar participant={participant as any} size="sm" />
								</div>
							</TableBodyCell>

							<!-- Round columns -->
							{#each roundNumbers as round}
								{@const field = getFieldForParticipantRound(participant.id, round)}
								<TableBodyCell class="text-center">
									{#if field}
										<Badge
											color={getFieldBadgeColor(field.id)}
											class="text-xs"
											id="field-badge-{participant.id}-{round}"
										>
											{field.name}
										</Badge>
										<Tooltip triggeredBy="#field-badge-{participant.id}-{round}" class="text-xs">
											{field.name} - Round {round}
										</Tooltip>
									{:else if isAdmin && availableSlots.length > 0}
										<!-- Dropdown for slot selection -->
										<Select
											size="sm"
											placeholder="Select slot..."
											class="min-w-48"
											items={[
												{ value: '', name: 'Select slot...' },
												...availableSlots.map((slot) => ({
													value: slot.id,
													name: formatSlotDescription(slot)
												}))
											]}
											onchange={(e) => {
												const target = e.target as HTMLSelectElement;
												const slotId = target?.value;
												if (slotId) {
													handleSlotAssignment(participant.id, round, slotId);
													// Reset the select after assignment
													target.value = '';
												}
											}}
										/>
									{:else}
										<span class="text-sm text-gray-400">—</span>
									{/if}
								</TableBodyCell>
							{/each}
						</TableBodyRow>
					{/each}
				{/if}
			</TableBody>
		</Table>
	</div>

	<!-- Summary -->
	{#if filteredParticipants.length > 0}
		<div class="text-sm text-gray-600">
			Showing {filteredParticipants.length} of {participants.length} participants
			{#if selectedFieldId}
				{@const selectedField = fieldMap.get(selectedFieldId)}
				{#if selectedField}
					who selected {selectedField.name}
				{/if}
			{/if}
		</div>
	{/if}
</div>
