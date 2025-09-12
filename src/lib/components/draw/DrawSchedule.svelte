<script lang="ts">
	import { Button, ButtonGroup, Card, MultiSelect } from 'flowbite-svelte';
	import {
		CalendarWeekOutline,
		ClockOutline,
		EditOutline,
		TableColumnOutline,
		ListOutline
	} from 'flowbite-svelte-icons';
	import { browser } from '$app/environment';
	import type { Field } from '$lib/components/schedules/types';
	import type { GroupConfig } from '$lib/components/grouper/grouper';
	import type { DrawSession, DrawParticipant, TimeSlot } from '$lib/types/draw-session';
	import Grouper from '$lib/components/grouper/Grouper.svelte';
	import FieldSlot from './FieldSlot.svelte';
	import SelectionMatrix from './SelectionMatrix.svelte';
	import BlockSlotModal from './BlockSlotModal.svelte';

	interface Props {
		session: DrawSession;
		participants: DrawParticipant[];
		timeSlots: TimeSlot[];
		fields: Map<string, Field>;
		isAdmin: boolean;
		canPickSlot: (slot: TimeSlot) => boolean;
		onAssignSlot: (slot: TimeSlot, participantId: string | null) => void;
		onPickSlot?: (slotId: string) => void;
		onBlockSlot?: (timeSlot: TimeSlot, reason: string) => Promise<void>;
		onUnblockSlot?: (timeSlot: TimeSlot) => Promise<void>;
		defaultDateRange: { start: string; end: string };
	}

	let {
		session,
		participants,
		timeSlots,
		fields,
		isAdmin,
		canPickSlot,
		onAssignSlot,
		onPickSlot,
		onBlockSlot,
		onUnblockSlot,
		defaultDateRange
	}: Props = $props();

	// Modal state
	let blockModalOpen = $state(false);
	let selectedSlotForBlock = $state<TimeSlot | null>(null);

	// State management
	let activeGroupKey: string | null = $state('time');
	let hideUnavailable = $state(false);
	let selectedFieldIds = $state<string[]>([]);
	let dateRange = $state({
		start: defaultDateRange.start,
		end: defaultDateRange.end
	});

	// Tab state management with URL persistence
	let activeTab = $state('schedule');

	// Initialize tab from URL parameter on component mount
	$effect(() => {
		if (browser) {
			const urlParams = new URLSearchParams(window.location.search);
			const tabParam = urlParams.get('tab');
			if (tabParam === 'matrix' || tabParam === 'schedule') {
				activeTab = tabParam;
			}

			// Listen for browser back/forward navigation
			const handlePopState = () => {
				const urlParams = new URLSearchParams(window.location.search);
				const tabParam = urlParams.get('tab');
				if (tabParam === 'matrix' || tabParam === 'schedule') {
					activeTab = tabParam;
				} else {
					activeTab = 'schedule'; // Default fallback
				}
			};

			window.addEventListener('popstate', handlePopState);

			// Cleanup listener on component destroy
			return () => {
				window.removeEventListener('popstate', handlePopState);
			};
		}
	});

	// Function to update tab and URL
	function setActiveTab(tab: 'schedule' | 'matrix') {
		activeTab = tab;
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.set('tab', tab);
			window.history.replaceState({}, '', url.toString());
		}
	}

	// Group configurations for the Grouper component
	const groupConfigs: GroupConfig<TimeSlot>[] = [
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
					? slot.weekdayName || ''
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

	// Handlers for block/unblock
	function handleBlockSlot(slot: TimeSlot) {
		selectedSlotForBlock = slot;
		blockModalOpen = true;
	}

	async function handleConfirmBlock(reason: string) {
		if (selectedSlotForBlock && onBlockSlot) {
			await onBlockSlot(selectedSlotForBlock, reason);
		}
	}

	async function handleUnblockSlot(slot: TimeSlot) {
		if (onUnblockSlot) {
			await onUnblockSlot(slot);
		}
	}

	// Reactive data processing
	const filteredSlots = $derived.by(() => {
		return timeSlots.filter((slot) => {
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
	});

	// No need to convert picks anymore - SelectionMatrix now uses timeSlots directly

	const rounds = $derived(session.rounds || 1);
	const fieldsArray = $derived(Array.from(fields.values()));
</script>

<div class="container mx-auto p-6">
	<!-- Header -->
	<div class="mb-6">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">{session.name}</h1>
				<p class="text-gray-600">Schedule Management</p>
			</div>

			<div class="flex items-center gap-4">
				{#if isAdmin}
					<Button color="alternative" href="/admin/draw-sessions/{session.id}/edit">
						<EditOutline class="mr-2 h-4 w-4" />
						Edit Session
					</Button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Tabs -->
	<div class="mb-6">
		<div class="border-b border-gray-200">
			<nav class="-mb-px flex space-x-8">
				<button
					class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'schedule'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					onclick={() => setActiveTab('schedule')}
				>
					<ListOutline class="mr-2 inline h-4 w-4" />
					Schedule View
				</button>
				<button
					class="border-b-2 px-1 py-2 text-sm font-medium {activeTab === 'matrix'
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					onclick={() => setActiveTab('matrix')}
				>
					<TableColumnOutline class="mr-2 inline h-4 w-4" />
					Matrix View
				</button>
			</nav>
		</div>
	</div>

	{#if activeTab === 'schedule'}
		<!-- Schedule View -->
		<div class="space-y-6">
			<!-- Controls -->
			<div class="flex flex-wrap items-center gap-4">
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

				<!-- Field Filter -->
				<MultiSelect
					bind:value={selectedFieldIds}
					items={fieldsArray.map((f) => ({ value: f.id, name: f.name }))}
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

			<!-- Time Slots Display -->
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
					<FieldSlot
						timeSlot={slot}
						{participants}
						{isAdmin}
						canPickSlot={canPickSlot(slot)}
						{onAssignSlot}
						{onPickSlot}
						onBlockSlot={handleBlockSlot}
						onUnblockSlot={handleUnblockSlot}
						{depth}
						{path}
						{index}
					/>
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
	{:else if activeTab === 'matrix'}
		<!-- Matrix View -->
		<SelectionMatrix
			{participants}
			fields={fieldsArray}
			{rounds}
			{timeSlots}
			{isAdmin}
			onAssignSlot={(slot, participantId, roundNumber) => {
				// Create a modified slot with the assignment details
				const assignedSlot = { ...slot, heldByUserId: participantId, roundNumber };
				onAssignSlot(assignedSlot, participantId);
			}}
		/>
	{/if}

	<!-- Block Slot Modal -->
	<BlockSlotModal
		bind:open={blockModalOpen}
		timeSlot={selectedSlotForBlock}
		onClose={() => {
			blockModalOpen = false;
			selectedSlotForBlock = null;
		}}
		onConfirm={handleConfirmBlock}
	/>
</div>
