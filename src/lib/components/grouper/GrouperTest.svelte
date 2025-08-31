<script lang="ts">
	import Grouper from './Grouper.svelte';
	import type { GroupConfig } from './grouper';

	// Sample data for testing
	interface TimeSlot {
		id: string;
		fieldName: string;
		weekday: string;
		weekdayName: string;
		startTime: string;
		endTime: string;
		status: string;
	}

	const sampleSlots: TimeSlot[] = [
		{
			id: '1',
			fieldName: 'Nelson Field',
			weekday: 'MO',
			weekdayName: 'Monday',
			startTime: '08:00',
			endTime: '10:00',
			status: 'available'
		},
		{
			id: '2',
			fieldName: 'Nelson Field',
			weekday: 'MO',
			weekdayName: 'Monday',
			startTime: '10:00',
			endTime: '12:00',
			status: 'picked'
		},
		{
			id: '3',
			fieldName: 'Campbell Field',
			weekday: 'TU',
			weekdayName: 'Tuesday',
			startTime: '08:00',
			endTime: '10:00',
			status: 'available'
		},
		{
			id: '4',
			fieldName: 'Campbell Field',
			weekday: 'TU',
			weekdayName: 'Tuesday',
			startTime: '10:00',
			endTime: '12:00',
			status: 'available'
		}
	];

	// Group configurations for testing
	const groupConfigs: GroupConfig<TimeSlot>[] = [
		{
			key: 'day',
			label: 'Day',
			enabled: true,
			value: (slot) => slot.weekday,
			sort: (a, b) =>
				['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(a) -
				['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(b)
		},
		{
			key: 'time',
			label: 'Time',
			enabled: true,
			value: (slot) => `${slot.startTime}–${slot.endTime}`
		},
		{
			key: 'field',
			label: 'Field',
			enabled: true,
			value: 'fieldName' // key path support
		}
	];

	let activeGroupKey: string | null = null;
</script>

<div class="p-6">
	<h1 class="mb-6 text-2xl font-bold">Grouper Component Test</h1>

	<!-- Group selection -->
	<div class="mb-6">
		<label for="group-select" class="mb-2 block text-sm font-medium text-gray-700"
			>Active Group Key:</label
		>
		<select id="group-select" bind:value={activeGroupKey} class="rounded border px-3 py-2">
			<option value={null}>All groups</option>
			<option value="day">Day only</option>
			<option value="time">Time only</option>
			<option value="field">Field only</option>
		</select>
	</div>

	<!-- Default rendering -->
	<div class="mb-8">
		<h2 class="mb-4 text-xl font-semibold">Default Rendering</h2>
		<div class="rounded border bg-gray-50 p-4">
			<Grouper items={sampleSlots} groups={groupConfigs} {activeGroupKey} />
		</div>
	</div>

	<!-- Custom snippet rendering -->
	<div class="mb-8">
		<h2 class="mb-4 text-xl font-semibold">Custom Snippet Rendering</h2>
		<div class="rounded border bg-gray-50 p-4">
			<Grouper items={sampleSlots} groups={groupConfigs} {activeGroupKey}>
				{#snippet header({ config, value, depth, itemCount, path })}
					<div class="mb-3 rounded bg-blue-100 p-3" style="margin-left: {depth * 1}rem">
						<h3 class="font-bold text-blue-900">
							📅 {config.label}: {value}
							<span class="ml-2 text-sm font-normal text-blue-700">
								({itemCount}
								{itemCount === 1 ? 'item' : 'items'})
							</span>
						</h3>
						{#if path.length > 0}
							<div class="mt-1 text-xs text-blue-600">
								Path: {path.map((p) => `${p.key}:${p.value}`).join(' → ')}
							</div>
						{/if}
					</div>
				{/snippet}

				{#snippet item({ item, depth, path, index })}
					<div
						class="mb-2 rounded border-l-4 border-green-500 bg-white p-3 shadow-sm"
						style="margin-left: {depth * 1}rem"
					>
						<div class="flex items-center justify-between">
							<div class="font-medium">{item.fieldName}</div>
							<div class="text-xs text-gray-400">#{index + 1}</div>
						</div>
						<div class="text-sm text-gray-600">
							{item.weekdayName}
							{item.startTime}–{item.endTime}
						</div>
						<div class="text-xs text-gray-500">
							Status: <span
								class="font-medium {item.status === 'available'
									? 'text-green-600'
									: 'text-orange-600'}">{item.status}</span
							>
						</div>
						{#if path.length > 0}
							<div class="mt-1 text-xs text-gray-400">
								Path: {path.map((p) => `${p.key}:${p.value}`).join(' → ')}
							</div>
						{/if}
					</div>
				{/snippet}

				{#snippet empty({ message })}
					<div class="py-12 text-center">
						<div class="mb-4 text-6xl">📭</div>
						<div class="text-lg font-medium text-gray-700">{message}</div>
						<div class="mt-2 text-sm text-gray-500">Try adjusting your group settings</div>
					</div>
				{/snippet}
			</Grouper>
		</div>
	</div>

	<!-- Empty state test -->
	<div class="mb-8">
		<h2 class="mb-4 text-xl font-semibold">Empty State Test</h2>
		<div class="rounded border bg-gray-50 p-4">
			<Grouper items={[]} groups={groupConfigs} emptyState="No time slots available">
				{#snippet empty({ message })}
					<div class="py-16 text-center">
						<div class="mb-6 text-8xl">🏟️</div>
						<div class="mb-2 text-2xl font-bold text-gray-800">{message}</div>
						<div class="mb-6 text-gray-600">Create some time slots to get started</div>
						<button
							class="rounded-lg bg-blue-500 px-6 py-2 font-medium text-white hover:bg-blue-600"
						>
							Add Time Slots
						</button>
					</div>
				{/snippet}
			</Grouper>
		</div>
	</div>
</div>
