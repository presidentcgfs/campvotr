<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { Button, Badge, Modal, Select, ButtonGroup, Card, MultiSelect } from 'flowbite-svelte';
	import {
		CalendarWeekOutline,
		ClockOutline,
		UserAddOutline,
		UserRemoveOutline,
		CheckOutline,
		EditOutline
	} from 'flowbite-svelte-icons';
	import type { Field } from '$lib/components/schedules/types';
	import Grouper from '$lib/components/grouper/Grouper.svelte';
	import type { GroupConfig } from '$lib/components/grouper/grouper';

	export let data: PageData;
	$: {
		console.log(data);
	}
	// State management
	let activeGroupKey: string | null = 'time';
	let hideUnavailable = false;
	let dateRange = {
		start: data.defaultDateRange.start,
		end: data.defaultDateRange.end
	};

	// Modal states
	let assignModalOpen = false;
	let unassignModalOpen = false;
	let pickModalOpen = false;
	let selectedSlot: any = null;
	let selectedParticipantId = '';

	$: fields = new Map<string, Field>(
		data.session.schedules.flatMap((s: any) => s.fields.map((f: any) => [f.id, f.field]))
	);
	$: selectedFieldIds = [] as string[];

	// Group configurations for the Grouper component
	const groupConfigs: GroupConfig<any>[] = [
		{
			key: 'time',
			label: 'Time',
			enabled: true,
			value: (slot) => {
				if (slot.isPattern) {
					return `${slot.weekdayName} ${slot.startTime}`;
				}
				const date = new Date(slot.startUtc);
				const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
				const time = date.toISOString().split('T')[1].substring(0, 5);
				return `${dayName} ${time}`;
			},
			sort: (a, b) => {
				// Extract day and time for sorting
				const [dayA, timeA] = a.split(' ');
				const [dayB, timeB] = b.split(' ');
				const dayOrder = [
					'Sunday',
					'Monday',
					'Tuesday',
					'Wednesday',
					'Thursday',
					'Friday',
					'Saturday'
				];
				const dayCompare = dayOrder.indexOf(dayA) - dayOrder.indexOf(dayB);
				if (dayCompare !== 0) return dayCompare;
				return timeA.localeCompare(timeB);
			}
		},
		{
			key: 'day',
			label: 'Day',
			enabled: true,
			value: (slot) =>
				slot.isPattern
					? slot.weekdayName
					: new Date(slot.startUtc).toLocaleDateString('en-US', { weekday: 'long' }),
			sort: (a, b) => {
				const dayOrder = [
					'Sunday',
					'Monday',
					'Tuesday',
					'Wednesday',
					'Thursday',
					'Friday',
					'Saturday'
				];
				return dayOrder.indexOf(a) - dayOrder.indexOf(b);
			}
		},
		{
			key: 'field',
			label: 'Field',
			enabled: true,
			value: 'fieldName',
			sort: 'asc'
		}
	];

	// Reactive data processing
	$: filteredSlots = data.timeSlots.filter((slot: any) => {
		// Filter by selected fields
		if (selectedFieldIds.length > 0 && !selectedFieldIds.includes(slot.fieldId)) {
			return false;
		}

		// Filter by availability status
		if (hideUnavailable && slot.status !== 'available') {
			return false;
		}

		// Filter by date range
		const slotDate = new Date(slot.startUtc);
		const start = new Date(dateRange.start);
		const end = new Date(dateRange.end);

		return slotDate >= start && slotDate < end;
	});

	// Utility functions for slot display
	function formatTimeRange(slot: any): string {
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

	// Utility functions
	function formatDate(date: Date): string {
		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		return `${days[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
	}

	function getSlotStatus(slot: any): { status: string; color: 'blue' | 'green'; text: string } {
		if (slot.assignedParticipantId) {
			const participant = data.participants.find((p: any) => p.id === slot.assignedParticipantId);
			return {
				status: 'assigned',
				color: 'blue' as const,
				text: participant?.displayName || 'Assigned'
			};
		}
		return {
			status: 'available',
			color: 'green' as const,
			text: 'Available'
		};
	}

	// Action handlers
	function openAssignModal(slot: any) {
		selectedSlot = slot;
		selectedParticipantId = '';
		assignModalOpen = true;
	}

	function openUnassignModal(slot: any) {
		selectedSlot = slot;
		unassignModalOpen = true;
	}

	function openPickModal(slot: any) {
		selectedSlot = slot;
		pickModalOpen = true;
	}

	function closeModals() {
		assignModalOpen = false;
		unassignModalOpen = false;
		pickModalOpen = false;
		selectedSlot = null;
		selectedParticipantId = '';
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

<div class="container mx-auto p-6">
	<!-- Header -->
	<div class="mb-6">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">{data.session.name}</h1>
				<p class="text-gray-600">Schedule Management</p>
			</div>

			<div class="flex items-center gap-4">
				{#if isAdmin()}
					<Button color="alternative" href="/admin/draw-sessions/{data.session.id}/edit">
						<EditOutline class="mr-2 h-4 w-4" />
						Edit Session
					</Button>
				{/if}

				<!-- Grouping Toggle -->
				<ButtonGroup>
					<Button
						color={activeGroupKey === 'time' ? 'blue' : 'alternative'}
						onclick={() => (activeGroupKey = 'time')}
					>
						<ClockOutline class="mr-2 h-4 w-4" />
						By Time
					</Button>
					<Button
						color={activeGroupKey === 'field' ? 'blue' : 'alternative'}
						onclick={() => (activeGroupKey = 'field')}
					>
						<CalendarWeekOutline class="mr-2 h-4 w-4" />
						By Field
					</Button>
					<Button
						color={activeGroupKey === 'day' ? 'blue' : 'alternative'}
						onclick={() => (activeGroupKey = 'day')}
					>
						<CalendarWeekOutline class="mr-2 h-4 w-4" />
						By Day
					</Button>
				</ButtonGroup>
			</div>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap gap-4">
			<!-- Field Filter -->
			<MultiSelect
				bind:value={selectedFieldIds}
				items={[...fields.values()].map((f) => {
					return { value: f.id, name: f.name };
				})}
				placeholder="All fields"
			/>

			<!-- Availability Filter -->
			<label class="flex cursor-pointer items-center gap-2">
				<input
					type="checkbox"
					bind:checked={hideUnavailable}
					class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
				/>
				<span class="text-sm text-gray-700">Hide unavailable slots</span>
			</label>
		</div>
	</div>

	<!-- Time Slots Display -->
	<div class="space-y-6">
		<Grouper
			items={filteredSlots}
			groups={groupConfigs}
			{activeGroupKey}
			emptyState="No time slots match your current filters."
		>
			{#snippet header({ config, value, depth, itemCount, path })}
				<Card class="mb-4 p-6">
					<div class="mb-4 border-b pb-2">
						<h2 class="text-lg font-semibold text-gray-900">
							{config.label}: {value}
							<span class="ml-2 text-sm font-normal text-gray-500">
								({itemCount}
								{itemCount === 1 ? 'slot' : 'slots'})
							</span>
						</h2>
					</div>
				</Card>
			{/snippet}

			{#snippet item({ item: slot, depth, path, index })}
				{@const slotStatus = getSlotStatus(slot)}
				<div
					class="mb-4 rounded-lg border p-4 transition-shadow hover:shadow-md"
					style="margin-left: {depth * 1}rem"
				>
					<div class="mb-3 flex items-start justify-between">
						<div>
							<div class="font-medium text-gray-900">
								{formatTimeRange(slot)}
							</div>
							<div class="text-sm text-gray-600">
								{slot.fieldName}
								{#if slot.isPattern}
									• {slot.weekdayName}
								{:else}
									• {formatDate(new Date(slot.startUtc))}
								{/if}
							</div>
							{#if path.length > 0}
								<div class="mt-1 text-xs text-gray-400">
									{path.map((p) => `${p.key}:${p.value}`).join(' → ')}
								</div>
							{/if}
						</div>

						<!-- Status Badge -->
						<Badge color={slotStatus.color} class="text-xs">
							{slotStatus.text}
						</Badge>
					</div>

					<!-- Actions -->
					<div class="flex gap-2">
						{#if isAdmin()}
							{#if slotStatus.status === 'available'}
								<Button size="xs" color="blue" onclick={() => openAssignModal(slot)}>
									<UserAddOutline class="mr-1 h-3 w-3" />
									Assign
								</Button>
							{:else}
								<Button size="xs" color="red" outline onclick={() => openUnassignModal(slot)}>
									<UserRemoveOutline class="mr-1 h-3 w-3" />
									Unassign
								</Button>
							{/if}
						{:else if canPickSlot(slot)}
							<Button size="xs" color="green" onclick={() => openPickModal(slot)}>
								<CheckOutline class="mr-1 h-3 w-3" />
								Pick this slot
							</Button>
						{:else}
							<Button size="xs" color="gray" disabled title="Not your turn or slot unavailable">
								Pick this slot
							</Button>
						{/if}
					</div>
				</div>
			{/snippet}

			{#snippet empty({ message })}
				<Card class="py-12 text-center">
					<CalendarWeekOutline class="mx-auto mb-4 h-12 w-12 text-gray-400" />
					<h3 class="mb-2 text-lg font-medium text-gray-900">No time slots found</h3>
					<p class="text-gray-600">{message}</p>
				</Card>
			{/snippet}
		</Grouper>
	</div>
</div>

<!-- Assign Modal -->
<Modal bind:open={assignModalOpen} size="sm" autoclose={false}>
	<div class="text-center">
		<UserAddOutline class="mx-auto mb-4 h-12 w-12 text-gray-400" />
		<h3 class="mb-5 text-lg font-normal text-gray-500">Assign time slot to participant</h3>

		{#if selectedSlot}
			<div class="mb-4 rounded-lg bg-gray-50 p-3 text-left">
				<div class="font-medium">{selectedSlot.fieldName}</div>
				<div class="text-sm text-gray-600">
					{formatTimeRange(selectedSlot)} UTC
				</div>
			</div>
		{/if}

		<form method="POST" action="?/assign" use:enhance>
			<input type="hidden" name="slotId" value={selectedSlot?.id || ''} />

			<div class="mb-4">
				<Select bind:value={selectedParticipantId} name="participantId" required>
					<option value="">Select participant...</option>
					{#each data.participants as participant}
						<option value={participant.id}>{participant.displayName}</option>
					{/each}
				</Select>
			</div>

			<div class="flex justify-center gap-3">
				<Button type="button" color="alternative" onclick={closeModals}>Cancel</Button>
				<Button type="submit" color="blue" disabled={!selectedParticipantId}>Assign</Button>
			</div>
		</form>
	</div>
</Modal>

<!-- Unassign Modal -->
<Modal bind:open={unassignModalOpen} size="sm" autoclose={false}>
	<div class="text-center">
		<UserRemoveOutline class="mx-auto mb-4 h-12 w-12 text-red-400" />
		<h3 class="mb-5 text-lg font-normal text-gray-500">Unassign this time slot?</h3>

		{#if selectedSlot}
			<div class="mb-4 rounded-lg bg-gray-50 p-3 text-left">
				<div class="font-medium">{selectedSlot.fieldName}</div>
				<div class="text-sm text-gray-600">
					{formatTimeRange(selectedSlot)} UTC
				</div>
				{#if selectedSlot.assignedParticipantId}
					{@const slotStatus = getSlotStatus(selectedSlot)}
					<div class="mt-1 text-sm text-blue-600">
						Currently assigned to: {slotStatus.text}
					</div>
				{/if}
			</div>
		{/if}

		<form method="POST" action="?/unassign" use:enhance>
			<input type="hidden" name="slotId" value={selectedSlot?.id || ''} />

			<div class="flex justify-center gap-3">
				<Button type="button" color="alternative" onclick={closeModals}>Cancel</Button>
				<Button type="submit" color="red">Unassign</Button>
			</div>
		</form>
	</div>
</Modal>

<!-- Pick Modal -->
<Modal bind:open={pickModalOpen} size="sm" autoclose={false}>
	<div class="text-center">
		<CheckOutline class="mx-auto mb-4 h-12 w-12 text-green-400" />
		<h3 class="mb-5 text-lg font-normal text-gray-500">Pick this time slot?</h3>

		{#if selectedSlot}
			<div class="mb-4 rounded-lg bg-gray-50 p-3 text-left">
				<div class="font-medium">{selectedSlot.fieldName}</div>
				<div class="text-sm text-gray-600">
					{formatTimeRange(selectedSlot)} UTC
				</div>
			</div>
		{/if}

		<form method="POST" action="?/pick" use:enhance>
			<input type="hidden" name="slotId" value={selectedSlot?.id || ''} />

			<div class="flex justify-center gap-3">
				<Button type="button" color="alternative" onclick={closeModals}>Cancel</Button>
				<Button type="submit" color="green">Pick this slot</Button>
			</div>
		</form>
	</div>
</Modal>
