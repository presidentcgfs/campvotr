<script lang="ts" context="module">
	export type EndCondition = 'never' | 'onDate' | 'afterCount';
</script>

<script lang="ts">
	import { Select, Input, Timepicker, Datepicker, Button, Badge } from 'flowbite-svelte';
	import { TrashBinOutline, PlusOutline } from 'flowbite-svelte-icons';
	import {
		type RecurrenceMulti,
		normalizeRecurrenceMulti,
		validateTimeWindows,
		validateInterval,
		validateCount,
		validateWeekdays
	} from './recurrence-utils.js';
	export let allowedEndConditions: EndCondition[] = ['never', 'onDate', 'afterCount'] as const;

	export let value: RecurrenceMulti = {
		frequency: 'once',
		interval: 1,
		startDate: new Date().toTemporalInstant(),
		endCondition: { type: 'afterCount', count: 1 },
		timeWindows: [{ start: '09:00', end: '10:00' }],
		exceptions: [],
		timezone: 'UTC'
	};

	// Frequency options
	const frequencyOptions = [
		{ value: 'once', name: 'Once' },
		{ value: 'daily', name: 'Daily' },
		{ value: 'weekly', name: 'Weekly' },
		{ value: 'monthly', name: 'Monthly' },
		{ value: 'yearly', name: 'Yearly' }
	];

	// Weekday options
	const weekdayOptions = [
		{ code: 'SU' as const, label: 'S' },
		{ code: 'MO' as const, label: 'M' },
		{ code: 'TU' as const, label: 'T' },
		{ code: 'WE' as const, label: 'W' },
		{ code: 'TH' as const, label: 'T' },
		{ code: 'FR' as const, label: 'F' },
		{ code: 'SA' as const, label: 'S' }
	];

	// Validation state
	let validationErrors: Record<string, string> = {};

	// Date for adding exceptions
	let newExceptionDate: Date | undefined = undefined;

	// Helper variables for date conversion
	let startDateForPicker: Date;
	let endDateForPicker: Date | undefined;

	// Reactive updates for date conversion
	$: startDateForPicker = new Date(value.startDate.epochMilliseconds);
	$: if (value.endCondition.type === 'onDate') {
		endDateForPicker = new Date(value.endCondition.onDate.epochMilliseconds);
	} else {
		endDateForPicker = undefined;
	}

	// Update Temporal.Instant when picker dates change
	$: if (startDateForPicker) {
		value.startDate = startDateForPicker.toTemporalInstant();
	}
	$: if (endDateForPicker && value.endCondition.type === 'onDate') {
		value.endCondition.onDate = endDateForPicker.toTemporalInstant();
	}

	// Reactive validation
	$: {
		validationErrors = {};

		// Normalize the recurrence to ensure timeWindows exists
		const normalized = normalizeRecurrenceMulti(value);

		// Time windows validation
		const timeWindowsError = validateTimeWindows(normalized.timeWindows);
		if (timeWindowsError) validationErrors.timeWindows = timeWindowsError;

		// Weekly weekdays validation
		const weekdaysError = validateWeekdays(normalized.weekdays || [], normalized.frequency);
		if (weekdaysError) validationErrors.weekdays = weekdaysError;

		// Interval validation
		const intervalError = validateInterval(normalized.interval);
		if (intervalError) validationErrors.interval = intervalError;

		// End condition validation
		if (normalized.endCondition.type === 'onDate') {
			const endDateMs = normalized.endCondition.onDate.epochMilliseconds;
			const startDateMs = normalized.startDate.epochMilliseconds;
			if (endDateMs < startDateMs) {
				validationErrors.endDate = 'End date must be on or after start date';
			}
		}

		if (normalized.endCondition.type === 'afterCount') {
			const countError = validateCount(normalized.endCondition.count);
			if (countError) validationErrors.afterCount = countError;
		}
	}

	// Handle frequency change reactively
	$: {
		if (value.frequency !== 'weekly') {
			if (value.weekdays) {
				value.weekdays = undefined;
				value = { ...value };
			}
		} else if (!value.weekdays) {
			value.weekdays = [];
			value = { ...value };
		}
	}

	// Handle weekday toggle
	function toggleWeekday(day: 'SU' | 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA') {
		if (!value.weekdays) value.weekdays = [];
		const index = value.weekdays.indexOf(day);
		if (index >= 0) {
			value.weekdays.splice(index, 1);
		} else {
			value.weekdays.push(day);
		}
		value = { ...value };
	}

	// Handle end condition change
	function onEndConditionChange(type: string) {
		if (type === 'never') {
			value.endCondition = { type: 'never' };
		} else if (type === 'onDate') {
			value.endCondition = { type: 'onDate', onDate: new Date().toTemporalInstant() };
		} else if (type === 'afterCount') {
			value.endCondition = { type: 'afterCount', count: 1 };
		}
		value = { ...value };
	}

	// Add exception date
	function addException() {
		if (newExceptionDate) {
			if (!value.exceptions) value.exceptions = [];
			value.exceptions.push(newExceptionDate.toTemporalInstant());
			value = { ...value };
			newExceptionDate = undefined;
		}
	}

	// Remove exception date
	function removeException(index: number) {
		if (value.exceptions) {
			value.exceptions.splice(index, 1);
			value = { ...value };
		}
	}

	// Time window management
	function addTimeWindow() {
		if (!value.timeWindows) value.timeWindows = [];
		if (value.timeWindows.length < 10) {
			let newStart = '09:00';
			let newEnd = '10:00';

			// If there are existing windows, use the last one as reference
			if (value.timeWindows.length > 0) {
				const lastWindow = value.timeWindows[value.timeWindows.length - 1];

				// Calculate duration of the last window
				const [lastStartHour, lastStartMinute] = lastWindow.start.split(':').map(Number);
				const [lastEndHour, lastEndMinute] = lastWindow.end.split(':').map(Number);
				const lastDurationMinutes =
					lastEndHour * 60 + lastEndMinute - (lastStartHour * 60 + lastStartMinute);

				// Set new start to last window's end
				newStart = lastWindow.end;

				// Calculate new end time with same duration
				const [startHour, startMinute] = newStart.split(':').map(Number);
				const startTotalMinutes = startHour * 60 + startMinute;
				const endTotalMinutes = startTotalMinutes + lastDurationMinutes;

				// Make sure we don't go past 23:59
				if (endTotalMinutes < 24 * 60) {
					const endHour = Math.floor(endTotalMinutes / 60);
					const endMinute = endTotalMinutes % 60;
					newEnd = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
				} else {
					// If it would go past midnight, just add 1 hour to the start
					const endTotalMinutes = startTotalMinutes + 60;
					if (endTotalMinutes < 24 * 60) {
						const endHour = Math.floor(endTotalMinutes / 60);
						const endMinute = endTotalMinutes % 60;
						newEnd = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
					} else {
						// If even 1 hour would go past midnight, keep it at the start time
						newEnd = newStart;
					}
				}
			}

			value.timeWindows.push({ start: newStart, end: newEnd });
			value = { ...value };
		}
	}

	function removeTimeWindow(index: number) {
		if (value.timeWindows && value.timeWindows.length > 1) {
			value.timeWindows.splice(index, 1);
			value = { ...value };
		}
	}

	// Ensure timeWindows exists and normalize from timeRange if needed
	$: {
		if (!value.timeWindows || value.timeWindows.length === 0) {
			if (value.timeRange) {
				value.timeWindows = [value.timeRange];
			} else {
				value.timeWindows = [{ start: '09:00', end: '10:00' }];
			}
		}
	}

	// Get interval unit label
	$: intervalUnit = (() => {
		const units = { once: '', daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };
		const unit = units[value.frequency];
		return value.interval === 1 ? unit : unit + 's';
	})();

	// Format date for display
	function formatDate(date: Date): string {
		return date.toLocaleDateString();
	}
</script>

<div class="space-y-4">
	<!-- Frequency Selection -->
	<div>
		<label for="frequency-select" class="mb-2 block text-sm font-medium">Frequency</label>
		<Select id="frequency-select" items={frequencyOptions} bind:value={value.frequency} />
	</div>

	<!-- Interval (for recurring frequencies) -->
	{#if value.frequency !== 'once'}
		<div>
			<label for="interval-input" class="mb-2 block text-sm font-medium">
				Repeat every
				{#if intervalUnit}
					<span class="text-gray-600">{intervalUnit}</span>
				{/if}
			</label>
			<Input id="interval-input" type="number" bind:value={value.interval} min={1} class="w-full" />
			{#if validationErrors.interval}
				<p class="mt-1 text-sm text-red-600">{validationErrors.interval}</p>
			{/if}
		</div>
	{/if}

	<!-- Weekdays (for weekly frequency) -->
	{#if value.frequency === 'weekly'}
		<div>
			<label class="mb-2 block text-sm font-medium">Repeat on</label>
			<div class="flex gap-2">
				{#each weekdayOptions as day}
					<button
						type="button"
						class="flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium transition-colors
							{value.weekdays?.includes(day.code)
							? 'border-blue-500 bg-blue-500 text-white'
							: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}"
						on:click={() => toggleWeekday(day.code)}
					>
						{day.label}
					</button>
				{/each}
			</div>
			{#if validationErrors.weekdays}
				<p class="mt-1 text-sm text-red-600">{validationErrors.weekdays}</p>
			{/if}
		</div>
	{/if}

	<!-- Start Date -->
	<div>
		<label for="startDate" class="mb-2 block text-sm font-medium">Start Date</label>
		<Datepicker id="startDate" bind:value={startDateForPicker} class="w-full" />
	</div>

	<!-- Time Windows -->
	<div>
		<div class="mb-2 flex items-center justify-between">
			<label class="text-sm font-medium">Time Windows</label>
			<button
				type="button"
				class="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 disabled:opacity-50"
				on:click={addTimeWindow}
				disabled={!value.timeWindows || value.timeWindows.length >= 10}
			>
				<PlusOutline class="h-3 w-3" />
				Add Window
			</button>
		</div>

		<div class="space-y-3">
			{#each value.timeWindows || [] as window, index}
				<div class="flex items-center gap-2 rounded border p-3">
					<div class="flex-1">
						<div class="flex flex-wrap justify-between gap-2">
							<div class="flex flex-wrap gap-2">
								<div>
									<label for="start-{index}" class="mb-1 block text-xs text-gray-600">Start</label>
									<Timepicker id="start-{index}" bind:value={window.start} />
								</div>
								<div>
									<label for="end-{index}" class="mb-1 block text-xs text-gray-600">End</label>
									<Timepicker id="end-{index}" bind:value={window.end} />
								</div>
							</div>
							{#if value.timeWindows && value.timeWindows.length > 1}
								<div class="flex flex-1 items-center justify-end">
									<Button
										outline
										pill
										size="xs"
										color="red"
										type="button"
										class="!p-2"
										onclick={() => removeTimeWindow(index)}
									>
										<TrashBinOutline size="xs" />
									</Button>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if validationErrors.timeWindows}
			<p class="mt-1 text-sm text-red-600">{validationErrors.timeWindows}</p>
		{/if}
	</div>

	<!-- End Condition -->
	{#if value.frequency !== 'once'}
		<div>
			<label for="endCondition" class="mb-2 block text-sm font-medium">Ends</label>
			<div class="space-y-2">
				{#if allowedEndConditions.includes('never')}
					<label class="flex items-center gap-2 py-3">
						<input
							id="endCondition"
							type="radio"
							name="endCondition"
							value="never"
							checked={value.endCondition.type === 'never'}
							on:change={() => onEndConditionChange('never')}
						/>
						Never
					</label>
				{/if}
				{#if allowedEndConditions.includes('onDate')}
					<div class="flex items-center gap-2">
						<label class="flex items-center gap-2 py-3">
							<input
								id="endCondition"
								type="radio"
								name="endCondition"
								value="onDate"
								class="py-2"
								checked={value.endCondition.type === 'onDate'}
								on:change={() => onEndConditionChange('onDate')}
							/>
							On
						</label>
						{#if value.endCondition.type === 'onDate'}
							<Datepicker bind:value={endDateForPicker} class="flex-1" />
						{/if}
					</div>
					{#if validationErrors.endDate}
						<p class="ml-6 text-sm text-red-600">{validationErrors.endDate}</p>
					{/if}
				{/if}
				{#if allowedEndConditions.includes('afterCount')}
					<div class="flex items-center gap-2">
						<label class="flex items-center gap-2 py-3">
							<input
								type="radio"
								name="endCondition"
								value="afterCount"
								checked={value.endCondition.type === 'afterCount'}
								on:change={() => onEndConditionChange('afterCount')}
							/>
							After
						</label>
						{#if value.endCondition.type === 'afterCount'}
							<Input type="number" bind:value={value.endCondition.count} min={1} class="w-20" />
							<span class="text-sm text-gray-600">occurrences</span>
						{/if}
					</div>
					{#if validationErrors.afterCount}
						<p class="ml-6 text-sm text-red-600">{validationErrors.afterCount}</p>
					{/if}
				{/if}
			</div>
		</div>
	{/if}

	<!-- Exceptions -->
	<div>
		<label for="exceptions" class="mb-2 block text-sm font-medium">Exceptions (Optional)</label>
		<div class="flex gap-2">
			<Datepicker id="exceptions" bind:value={newExceptionDate} class="flex-1" />
			<Button onclick={addException} disabled={!newExceptionDate}>Add</Button>
		</div>
		{#if value.exceptions && value.exceptions.length > 0}
			<div class="mt-2 flex flex-wrap gap-2">
				{#each value.exceptions as exception, index}
					<Badge color="gray" class="flex items-center gap-1">
						{formatDate(new Date(exception.epochMilliseconds))}
						<button
							type="button"
							on:click={() => removeException(index)}
							class="ml-1 hover:text-red-600"
						>
							<TrashBinOutline size="xs" />
						</button>
					</Badge>
				{/each}
			</div>
		{/if}
	</div>
</div>
