<script lang="ts">
	import { Select, Input, Timepicker, Datepicker, Button, Badge } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import {
		type Recurrence,
		toRRuleTemporalOptions,
		fromRRuleTemporalOptions,
		validateTimeRange,
		validateInterval,
		validateCount,
		validateWeekdays
	} from './recurrence-utils.js';

	export let value: Recurrence = {
		frequency: 'once',
		interval: 1,
		startDate: new Date(),
		endCondition: { type: 'never' },
		timeRange: { start: '09:00', end: '10:00' },
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

	// Re-export the utility functions for external use
	export { toRRuleTemporalOptions, fromRRuleTemporalOptions } from './recurrence-utils.js';

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

	// Reactive validation
	$: {
		validationErrors = {};

		// Time range validation
		const timeRangeError = validateTimeRange(value.timeRange.start, value.timeRange.end);
		if (timeRangeError) validationErrors.timeRange = timeRangeError;

		// Weekly weekdays validation
		const weekdaysError = validateWeekdays(value.weekdays, value.frequency);
		if (weekdaysError) validationErrors.weekdays = weekdaysError;

		// Interval validation
		const intervalError = validateInterval(value.interval);
		if (intervalError) validationErrors.interval = intervalError;

		// End condition validation
		if (value.endCondition.type === 'onDate') {
			const endDate = value.endCondition.onDate;
			if (endDate < value.startDate) {
				validationErrors.endDate = 'End date must be on or after start date';
			}
		}

		if (value.endCondition.type === 'afterCount') {
			const countError = validateCount(value.endCondition.count);
			if (countError) validationErrors.afterCount = countError;
		}
	}

	// Handle frequency change
	function onFrequencyChange() {
		if (value.frequency !== 'weekly') {
			value.weekdays = undefined;
		} else if (!value.weekdays) {
			value.weekdays = [];
		}
		value = { ...value };
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
			value.endCondition = { type: 'onDate', onDate: new Date() };
		} else if (type === 'afterCount') {
			value.endCondition = { type: 'afterCount', count: 1 };
		}
		value = { ...value };
	}

	// Add exception date
	function addException() {
		if (newExceptionDate) {
			if (!value.exceptions) value.exceptions = [];
			value.exceptions.push(new Date(newExceptionDate));
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
		<label class="mb-2 block text-sm font-medium">Frequency</label>
		<Select items={frequencyOptions} bind:value={value.frequency} on:change={onFrequencyChange} />
	</div>

	<!-- Interval (for recurring frequencies) -->
	{#if value.frequency !== 'once'}
		<div>
			<label class="mb-2 block text-sm font-medium">
				Repeat every
				{#if intervalUnit}
					<span class="text-gray-600">{intervalUnit}</span>
				{/if}
			</label>
			<Input type="number" bind:value={value.interval} min={1} class="w-full" />
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
		<Datepicker id="startDate" bind:value={value.startDate} class="w-full" />
	</div>

	<!-- Time Range -->
	<div>
		<label for="timeRange" class="mb-2 block text-sm font-medium">Time Range</label>
		<Timepicker
			id="timeRange"
			type="range"
			bind:value={value.timeRange.start}
			bind:endValue={value.timeRange.end}
		/>
		{#if validationErrors.timeRange}
			<p class="mt-1 text-sm text-red-600">{validationErrors.timeRange}</p>
		{/if}
	</div>

	<!-- End Condition -->
	{#if value.frequency !== 'once'}
		<div>
			<label for="endCondition" class="mb-2 block text-sm font-medium">Ends</label>
			<div class="space-y-2">
				<label class="flex items-center gap-2">
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

				<div class="flex items-center gap-2">
					<label class="flex items-center gap-2">
						<input
							id="endCondition"
							type="radio"
							name="endCondition"
							value="onDate"
							checked={value.endCondition.type === 'onDate'}
							on:change={() => onEndConditionChange('onDate')}
						/>
						On
					</label>
					{#if value.endCondition.type === 'onDate'}
						<Datepicker bind:value={value.endCondition.onDate} class="flex-1" />
					{/if}
				</div>
				{#if validationErrors.endDate}
					<p class="ml-6 text-sm text-red-600">{validationErrors.endDate}</p>
				{/if}

				<div class="flex items-center gap-2">
					<label class="flex items-center gap-2">
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
						{formatDate(exception)}
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
