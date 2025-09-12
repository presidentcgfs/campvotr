<script lang="ts">
	import { Modal, Label, Input, Textarea, Button, Alert } from 'flowbite-svelte';
	import { ExclamationCircleOutline } from 'flowbite-svelte-icons';
	import type { TimeSlot } from '$lib/types/draw-session';

	interface Props {
		open: boolean;
		timeSlot: TimeSlot | null;
		onClose: () => void;
		onConfirm: (reason: string) => Promise<void>;
	}

	let { open = $bindable(), timeSlot, onClose, onConfirm }: Props = $props();

	let blockReason = $state('');
	let isSubmitting = $state(false);
	let error = $state('');

	// Reset form when modal opens/closes
	$effect(() => {
		if (open) {
			blockReason = '';
			error = '';
			isSubmitting = false;
		}
	});

	async function handleSubmit() {
		if (!blockReason.trim()) {
			error = 'Please provide a reason for blocking this time slot';
			return;
		}

		if (!timeSlot) {
			error = 'No time slot selected';
			return;
		}

		isSubmitting = true;
		error = '';

		try {
			await onConfirm(blockReason.trim());
			onClose();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to block time slot';
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		if (!isSubmitting) {
			onClose();
		}
	}

	function formatSlotTime(slot: TimeSlot): string {
		return `${slot.weekdayName || slot.weekday} ${slot.startTime}-${slot.endTime}`;
	}
</script>

<Modal bind:open title="Block Time Slot" size="md">
	{#if timeSlot}
		<div class="space-y-4">
			<!-- Slot Information -->
			<div class="rounded-lg bg-gray-50 p-4">
				<p class="text-sm font-medium text-gray-700">Time Slot</p>
				<p class="mt-1 text-lg font-semibold text-gray-900">
					{formatSlotTime(timeSlot)}
				</p>
				<p class="mt-1 text-sm text-gray-600">
					Field: {timeSlot.fieldName}
				</p>
			</div>

			<!-- Warning Message -->
			<Alert color="yellow" class="flex items-start">
				<ExclamationCircleOutline slot="icon" class="h-5 w-5" />
				<span class="text-sm">
					Blocking this time slot will make it unavailable for selection by participants.
					The slot can be unblocked later if needed.
				</span>
			</Alert>

			<!-- Block Reason Input -->
			<div>
				<Label for="blockReason" class="mb-2">
					Reason for blocking <span class="text-red-500">*</span>
				</Label>
				<Textarea
					id="blockReason"
					bind:value={blockReason}
					placeholder="Enter the reason for blocking this time slot (e.g., maintenance, weather, conflict)..."
					rows={4}
					disabled={isSubmitting}
					class="w-full"
				/>
			</div>

			{#if error}
				<Alert color="red">
					<ExclamationCircleOutline slot="icon" class="h-4 w-4" />
					{error}
				</Alert>
			{/if}
		</div>
	{/if}

	<svelte:fragment slot="footer">
		<div class="flex w-full justify-end gap-2">
			<Button
				color="alternative"
				onclick={handleCancel}
				disabled={isSubmitting}
			>
				Cancel
			</Button>
			<Button
				color="red"
				onclick={handleSubmit}
				disabled={isSubmitting || !blockReason.trim()}
			>
				{isSubmitting ? 'Blocking...' : 'Block Slot'}
			</Button>
		</div>
	</svelte:fragment>
</Modal>
