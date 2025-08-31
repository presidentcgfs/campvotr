<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import {
		Button,
		Badge,
		Modal,
		Select,
		Search,
		ButtonGroup,
		Card,
		MultiSelect
	} from 'flowbite-svelte';
	import {
		CalendarWeekOutline,
		ClockOutline,
		UserAddOutline,
		UserRemoveOutline,
		CheckOutline
	} from 'flowbite-svelte-icons';
	import type { Field } from '$lib/components/schedules/types';

	export let data: PageData;
	$: {
		console.log(data);
	}
	// State management
	let groupBy: 'time' | 'field' | 'day' = 'time';
	let searchQuery = '';
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
		data.session.schedules.flatMap((s) => s.fields.map((f) => [f.id, f.field]))
	);
	$: selectedFieldIds = [] as string[];
	// Reactive data processing
	$: filteredSlots = data.timeSlots.filter((slot: any) => {
		// Filter by search query (field name)
		if (searchQuery && !slot.fieldName?.toLowerCase().includes(searchQuery.toLowerCase())) {
			return false;
		}

		// Filter by selected fields
		if (selectedFieldIds.length > 0 && !selectedFieldIds.includes(slot.fieldId)) {
			return false;
		}

		// Filter by date range
		const slotDate = new Date(slot.startUtc);
		const start = new Date(dateRange.start);
		const end = new Date(dateRange.end);

		return slotDate >= start && slotDate < end;
	});

	$: groupedSlots = groupSlots(filteredSlots, groupBy);

	// Grouping logic
	function groupSlots(slots: any[], groupBy: 'time' | 'field' | 'day') {
		if (groupBy === 'time') {
			return groupByTime(slots);
		} else if (groupBy === 'field') {
			return groupByField(slots);
		} else {
			return groupByDay(slots);
		}
	}

	function groupByTime(slots: any[]) {
		const groups = new Map();

		slots.forEach((slot) => {
			// For recurring patterns, group by weekday and time
			const groupKey = slot.isPattern
				? `${slot.weekday}_${slot.startTime}`
				: `${new Date(slot.startUtc).toISOString().split('T')[0]}_${new Date(slot.startUtc).toISOString().split('T')[1].substring(0, 5)}`;

			if (!groups.has(groupKey)) {
				if (slot.isPattern) {
					groups.set(groupKey, {
						weekday: slot.weekday,
						weekdayName: slot.weekdayName,
						time: slot.startTime,
						displayDate: slot.weekdayName,
						displayTime: slot.startTime,
						slots: []
					});
				} else {
					const date = new Date(slot.startUtc);
					const dayKey = date.toISOString().split('T')[0];
					const timeKey = date.toISOString().split('T')[1].substring(0, 5);
					groups.set(groupKey, {
						date: dayKey,
						time: timeKey,
						displayDate: formatDate(date),
						displayTime: timeKey,
						slots: []
					});
				}
			}

			groups.get(groupKey).slots.push(slot);
		});

		// Sort by weekday/date and time
		return Array.from(groups.values()).sort((a, b) => {
			if (a.weekday && b.weekday) {
				const dayOrder = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
				const dayCompare = dayOrder.indexOf(a.weekday) - dayOrder.indexOf(b.weekday);
				if (dayCompare !== 0) return dayCompare;
				return a.time.localeCompare(b.time);
			}
			// Fallback for non-pattern slots
			const dateCompare = (a.date || '').localeCompare(b.date || '');
			if (dateCompare !== 0) return dateCompare;
			return a.time.localeCompare(b.time);
		});
	}

	function groupByField(slots: any[]) {
		const groups = new Map();

		slots.forEach((slot) => {
			const fieldKey = slot.fieldId;

			if (!groups.has(fieldKey)) {
				groups.set(fieldKey, {
					fieldId: slot.fieldId,
					fieldName: slot.fieldName || 'Unknown Field',
					slots: []
				});
			}

			groups.get(fieldKey).slots.push(slot);
		});

		// Sort fields alphabetically and slots by time within each field
		return Array.from(groups.values())
			.sort((a, b) => a.fieldName.localeCompare(b.fieldName))
			.map((group) => ({
				...group,
				slots: group.slots.sort(
					(a: any, b: any) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime()
				)
			}));
	}

	function groupByDay(slots: any[]) {
		const groups = new Map();

		slots.forEach((slot) => {
			// Group by weekday for recurring patterns
			const groupKey = slot.isPattern
				? slot.weekday
				: new Date(slot.startUtc).getUTCDay().toString();

			if (!groups.has(groupKey)) {
				if (slot.isPattern) {
					groups.set(groupKey, {
						weekday: slot.weekday,
						weekdayName: slot.weekdayName,
						displayName: slot.weekdayName,
						slots: []
					});
				} else {
					const date = new Date(slot.startUtc);
					const dayNames = [
						'Sunday',
						'Monday',
						'Tuesday',
						'Wednesday',
						'Thursday',
						'Friday',
						'Saturday'
					];
					groups.set(groupKey, {
						weekday: groupKey,
						weekdayName: dayNames[date.getUTCDay()],
						displayName: dayNames[date.getUTCDay()],
						slots: []
					});
				}
			}

			groups.get(groupKey).slots.push(slot);
		});

		// Sort by weekday order and then by time within each day
		return Array.from(groups.values())
			.sort((a, b) => {
				const dayOrder = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
				const aIndex =
					dayOrder.indexOf(a.weekday) !== -1 ? dayOrder.indexOf(a.weekday) : parseInt(a.weekday);
				const bIndex =
					dayOrder.indexOf(b.weekday) !== -1 ? dayOrder.indexOf(b.weekday) : parseInt(b.weekday);
				return aIndex - bIndex;
			})
			.map((group) => ({
				...group,
				slots: group.slots.sort((a: any, b: any) => {
					if (a.isPattern && b.isPattern) {
						return a.startTime.localeCompare(b.startTime);
					}
					return new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime();
				})
			}));
	}

	// Utility functions
	function formatDate(date: Date): string {
		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		return `${days[date.getUTCDay()]} ${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
	}

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

			<!-- Grouping Toggle -->
			<ButtonGroup>
				<Button
					color={groupBy === 'time' ? 'blue' : 'alternative'}
					onclick={() => (groupBy = 'time')}
				>
					<ClockOutline class="mr-2 h-4 w-4" />
					By Time
				</Button>
				<Button
					color={groupBy === 'field' ? 'blue' : 'alternative'}
					onclick={() => (groupBy = 'field')}
				>
					<CalendarWeekOutline class="mr-2 h-4 w-4" />
					By Field
				</Button>
				<Button
					color={groupBy === 'day' ? 'blue' : 'alternative'}
					onclick={() => (groupBy = 'day')}
				>
					<CalendarWeekOutline class="mr-2 h-4 w-4" />
					By Day
				</Button>
			</ButtonGroup>
		</div>

		<!-- Filters -->
		<div class="flex flex-wrap gap-4">
			<div class="min-w-64 flex-1">
				<Search bind:value={searchQuery} placeholder="Search fields..." size="md" />
			</div>

			<!-- Field Filter -->
			<MultiSelect
				bind:value={selectedFieldIds}
				items={[...fields.values()].map((f) => {
					return { value: f.id, name: f.name };
				})}
			/>
		</div>
	</div>

	<!-- Time Slots Display -->
	<div class="space-y-6">
		{#if groupedSlots.length === 0}
			<Card class="py-12 text-center">
				<CalendarWeekOutline class="mx-auto mb-4 h-12 w-12 text-gray-400" />
				<h3 class="mb-2 text-lg font-medium text-gray-900">No time slots found</h3>
				<p class="text-gray-600">No time slots match your current filters.</p>
			</Card>
		{:else}
			{#each groupedSlots as group}
				<Card class="p-6">
					<!-- Group Header -->
					<div class="mb-4 border-b pb-2">
						{#if groupBy === 'time'}
							<h2 class="text-lg font-semibold text-gray-900">
								{group.displayDate} at {group.displayTime}
							</h2>
						{:else if groupBy === 'field'}
							<h2 class="text-lg font-semibold text-gray-900">
								{group.fieldName}
							</h2>
						{:else}
							<h2 class="text-lg font-semibold text-gray-900">
								{group.displayName}
							</h2>
						{/if}
					</div>

					<!-- Slots Grid -->
					<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each group.slots as slot}
							{@const slotStatus = getSlotStatus(slot)}
							<div class="rounded-lg border p-4 transition-shadow hover:shadow-md">
								<div class="mb-3 flex items-start justify-between">
									<div>
										<div class="font-medium text-gray-900">
											{formatTimeRange(slot)}
										</div>
										{#if groupBy === 'time'}
											<div class="text-sm text-gray-600">{slot.fieldName}</div>
										{:else if groupBy === 'field'}
											<div class="text-sm text-gray-600">
												{#if slot.isPattern}
													{slot.weekdayName}
												{:else}
													{formatDate(new Date(slot.startUtc))}
												{/if}
											</div>
										{:else}
											<!-- Day grouping - show field name -->
											<div class="text-sm text-gray-600">{slot.fieldName}</div>
										{/if}
									</div>
									<Badge color={slotStatus.color} class="text-xs">
										{slotStatus.text}
									</Badge>
								</div>

								<!-- Action Buttons -->
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
										<Button
											size="xs"
											color="gray"
											disabled
											title="Not your turn or slot unavailable"
										>
											Pick this slot
										</Button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/each}
		{/if}
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
