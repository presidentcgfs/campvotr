<script lang="ts">
	import type { PageData } from './$types';
	import type { Field } from '$lib/components/schedules/types';
	import type { TimeSlot } from '$lib/types/draw-session';
	import DrawSchedule from '$lib/components/draw/DrawSchedule.svelte';
	const { data } = $props<{ data: PageData }>();

	let fields = $derived(
		new Map<string, Field>(
			data.session.schedules?.flatMap((s: any) =>
				s.fields.map((f: any) => [f.fieldId || f.id, f.field])
			) || []
		)
	);

	// Handler functions for the DrawSchedule component
	async function handleAssignSlot(slot: TimeSlot, participantId: string | null) {
		if (!slot.pattern || !slot.fieldId) {
			console.error('Missing pattern or fieldId for slot:', slot.id);
			return;
		}

		const formData = new FormData();

		if (participantId) {
			formData.append('participantId', participantId);
			formData.set('heldByUserId', participantId);

			Object.entries(slot).forEach(([key, value]) => {
				if (value !== undefined) {
					formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
				}
			});

			const response = await fetch('?/assign', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				// Update local state immediately for better UX
				const foundSlot = data.timeSlots.find((s: any) => s.id === slot.id);
				if (foundSlot) {
					foundSlot.heldByUserId = participantId;
					foundSlot.status = 'picked';
				}
				// Reload the page to get updated data
				window.location.reload();
			} else {
				console.error('Failed to assign participant');
			}
		} else {
			const response = await fetch('?/unassign', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				// Update local state immediately for better UX
				const foundSlot = data.timeSlots.find((s: any) => s.id === slot.id);
				if (foundSlot) {
					foundSlot.heldByUserId = null;
					foundSlot.status = 'available';
				}
				// Reload the page to get updated data
				window.location.reload();
			} else {
				console.error('Failed to unassign participant');
			}
		}
	}

	async function handlePickSlot(slotId: string) {
		const formData = new FormData();
		formData.append('slotId', slotId);

		const response = await fetch('?/pick', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			// Reload the page to get updated data
			window.location.reload();
		}
	}

	async function handleBlockSlot(timeSlot: TimeSlot, reason: string) {
		const formData = new FormData();
		formData.append('pattern', timeSlot.pattern);
		formData.append('fieldId', timeSlot.fieldId);
		formData.append('reason', reason);

		if (timeSlot.isSynthetic) {
			formData.append('isSynthetic', 'true');
			formData.append('startUtc', timeSlot.startUtc);
			formData.append('endUtc', timeSlot.endUtc);
		}

		const response = await fetch('?/block', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			window.location.reload();
		} else {
			throw new Error('Failed to block slot');
		}
	}

	async function handleUnblockSlot(timeSlot: TimeSlot) {
		const formData = new FormData();
		formData.append('pattern', timeSlot.pattern);
		formData.append('fieldId', timeSlot.fieldId);

		const response = await fetch('?/unblock', {
			method: 'POST',
			body: formData
		});

		if (response.ok) {
			window.location.reload();
		} else {
			throw new Error('Failed to unblock slot');
		}
	}

	// Check if user can pick (simplified - needs proper turn logic)
	function canPickSlot(slot: any): boolean {
		// TODO: Implement proper turn checking logic
		return slot.status === 'available';
	}

	// Check if user is admin (simplified - needs proper role checking)
	function isAdmin(): boolean {
		// TODO: Implement proper role checking
		return true;
	}
</script>

<DrawSchedule
	session={data.session}
	participants={data.participants}
	timeSlots={data.timeSlots}
	{fields}
	isAdmin={isAdmin()}
	{canPickSlot}
	onAssignSlot={handleAssignSlot}
	onPickSlot={handlePickSlot}
	onBlockSlot={handleBlockSlot}
	onUnblockSlot={handleUnblockSlot}
	defaultDateRange={data.defaultDateRange}
/>
