<script lang="ts">
	import { Badge, Button, P } from 'flowbite-svelte';
	import { UserAddOutline, BanOutline, LockOpenOutline } from 'flowbite-svelte-icons';
	import ParticipantSelector from './ParticipantSelector.svelte';
	import type { DrawParticipant, TimeSlot } from '$lib/types/draw-session';
	import ParticipantAvatar from '../ParticipantAvatar.svelte';

	interface Props {
		timeSlot: TimeSlot;
		participants: DrawParticipant[];
		isAdmin: boolean;
		canPickSlot: boolean;
		onAssignSlot: (slot: TimeSlot, participantId: string | null) => void;
		onPickSlot?: (slotId: string) => void;
		onBlockSlot?: (timeSlot: TimeSlot) => void;
		onUnblockSlot?: (timeSlot: TimeSlot) => void;
		depth?: number;
		path?: Array<{ key: string; value: string }>;
		index?: number;
	}

	let {
		timeSlot = $bindable(),
		participants = $bindable([]),
		isAdmin,
		canPickSlot,
		onAssignSlot,
		onPickSlot,
		onBlockSlot,
		onUnblockSlot,
		depth = 0,
		path = [],
		index = 0
	}: Props = $props();

	// Local state for inline editing

	// Get assigned participant
	const assignedParticipant = $derived.by(() => {
		if (!timeSlot.heldByUserId) return null;
		return participants.find((p) => p.id === timeSlot.heldByUserId) || null;
	});

	// Slot status
	const slotStatus = $derived.by(() => {
		if (assignedParticipant) {
			return {
				status: 'assigned',
				color: 'blue' as const,
				text: assignedParticipant.displayName
			};
		}
		return {
			status: 'available',
			color: 'green' as const,
			text: 'Available'
		};
	});

	function formatTimeRange(slot: TimeSlot): string {
		// For recurring patterns, use the pattern times directly
		if (slot.isPattern) {
			return `${slot.startTime}–${slot.endTime}`;
		}
		// For literal time slots, extract from UTC timestamps
		const start = new Date(slot.startUtc);
		const end = new Date(slot.endUtc);
		const startTime = start.toISOString().split('T')[1].substring(0, 5);
		const endTime = end.toISOString().split('T')[1].substring(0, 5);
		return `${startTime}–${endTime}`;
	}

	function formatDate(date: Date): string {
		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		return `${days[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
	}

	function handleParticipantSelect(participantId: string | null) {
		// Pass the complete timeSlot and participantId
		timeSlot.heldByUserId = participantId || undefined;
		onAssignSlot(timeSlot, participantId);
	}

	function handlePickClick() {
		if (onPickSlot && canPickSlot) {
			onPickSlot(timeSlot.id);
		}
	}
</script>

<div
	class="mb-4 rounded-lg border p-4 transition-shadow hover:shadow-md"
	style="margin-left: {depth * 1}rem"
>
	<div class="mb-3 flex items-start justify-between">
		<div class="flex-1">
			<div class="font-medium text-gray-900">
				{formatTimeRange(timeSlot)}
			</div>
			<div class="text-sm text-gray-600">
				{timeSlot.fieldName}
				{#if timeSlot.weekdayName}
					• {timeSlot.weekdayName}
				{:else}
					• {formatDate(new Date(timeSlot.startUtc))}
				{/if}
			</div>
			{#if path.length > 0}
				<div class="mt-1 text-xs text-gray-400">
					{path.map((p) => `${p.key}:${p.value}`).join(' → ')}
				</div>
			{/if}
		</div>

		{#if timeSlot.heldByUserId}
			<ParticipantAvatar participant={timeSlot.heldByUser!} size="sm" />
		{:else}
			<!-- Status Badge -->
			<Badge color={slotStatus.color} class="text-xs">
				{slotStatus.text}
			</Badge>
		{/if}
	</div>

	<!-- Actions -->
	<div class="flex gap-2">
		{#if !isAdmin && canPickSlot && slotStatus.status === 'available'}
			<Button size="xs" color="green" onclick={handlePickClick}>
				<UserAddOutline class="mr-1 h-3 w-3" />
				Pick this slot
			</Button>
		{:else if !isAdmin && !canPickSlot}
			<Button size="xs" color="gray" disabled title="Not your turn or slot unavailable">
				Pick this slot
			</Button>
		{/if}

		{#if isAdmin}
			{#if !timeSlot.heldByUserId}
				<ParticipantSelector
					{participants}
					disabled={!isAdmin}
					selectedParticipantId={timeSlot.heldByUserId}
					onSelect={handleParticipantSelect}
					placeholder="Choose participant..."
					ariaLabel={`Select participant for ${timeSlot.fieldName} at ${formatTimeRange(timeSlot)}`}
				/>
			{/if}
			{#if timeSlot.status === 'blocked'}
				<Button
					size="xs"
					color="yellow"
					onclick={() => onUnblockSlot?.(timeSlot)}
					title="Unblock this time slot"
				>
					<LockOpenOutline class="mr-1 h-3 w-3" />
					Unblock
				</Button>
			{:else if timeSlot.status === 'available'}
				<Button
					size="xs"
					color="red"
					outline
					onclick={() => onBlockSlot?.(timeSlot)}
					title="Block this time slot"
				>
					<BanOutline class="mr-1 h-3 w-3" />
					Block
				</Button>
			{/if}
		{/if}
	</div>
</div>
