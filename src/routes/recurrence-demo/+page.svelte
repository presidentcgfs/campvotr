<script lang="ts">
	import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
	import {
		toRRuleTemporalOptions,
		type Recurrence,
		getRecurrenceDescription
	} from '$lib/components/recurrence/recurrence-utils.js';
	import { RRuleTemporal } from 'rrule-temporal';
	import { generateTimeSlots } from '$lib/components/recurrence/example.js';
	import { Card, Button, Badge } from 'flowbite-svelte';

	let recurrence: Recurrence = {
		frequency: 'weekly',
		interval: 1,
		weekdays: ['MO', 'WE', 'FR'],
		startDate: new Date(),
		endCondition: { type: 'afterCount', count: 5 },
		timeRange: { start: '09:00', end: '10:00' },
		exceptions: [],
		timezone: 'UTC'
	};

	let generatedSlots: Date[] = [];
	let rruleString = '';
	let description = '';

	function generateSlots() {
		try {
			// Generate time slots using rrule-temporal
			generatedSlots = generateTimeSlots(recurrence);

			// Get the RRULE string representation
			const rruleOptions = toRRuleTemporalOptions(recurrence);
			const rule = new RRuleTemporal(rruleOptions);
			rruleString = rule.toString();

			// Get human-readable description
			description = getRecurrenceDescription(recurrence);
		} catch (error) {
			console.error('Error generating slots:', error);
			generatedSlots = [];
			rruleString = 'Error generating rule';
			description = 'Error in configuration';
		}
	}

	// Generate slots when component loads
	$: if (recurrence) {
		generateSlots();
	}
</script>

<svelte:head>
	<title>Recurrence Picker Demo</title>
</svelte:head>

<div class="container mx-auto max-w-4xl p-6">
	<h1 class="mb-6 text-3xl font-bold">Recurrence Picker with rrule-temporal</h1>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Configuration Panel -->
		<Card class="p-6">
			<h2 class="mb-4 text-xl font-semibold">Configure Recurrence</h2>
			<RecurrencePicker bind:value={recurrence} />
		</Card>

		<!-- Results Panel -->
		<Card class="p-6">
			<h2 class="mb-4 text-xl font-semibold">Generated Results</h2>

			<!-- Description -->
			<div class="mb-4 p-3">
				<h3 class="mb-2 text-lg font-medium">Description</h3>
				<p class="rounded bg-gray-50 p-3 text-gray-700">{description}</p>
			</div>

			<!-- RRULE String -->
			<div class="mb-4 p-3">
				<h3 class="mb-2 text-lg font-medium">RRULE String</h3>
				<pre
					class="overflow-x-auto rounded bg-gray-100 p-3 text-sm whitespace-pre-wrap">{rruleString}</pre>
			</div>

			<!-- Generated Time Slots -->
			<div class="mb-4">
				<h3 class="mb-2 text-lg font-medium">
					Generated Time Slots
					<Badge color="blue">{generatedSlots.length}</Badge>
				</h3>

				{#if generatedSlots.length > 0}
					<div class="max-h-64 space-y-2 overflow-y-auto">
						{#each generatedSlots as slot, i}
							<div class="flex items-center justify-between rounded bg-gray-50 p-2">
								<span class="font-mono text-sm">
									{slot.toLocaleString('en-US', {
										weekday: 'short',
										year: 'numeric',
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit',
										timeZoneName: 'short'
									})}
								</span>
								<Badge color="gray" class="text-xs">{i + 1}</Badge>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-gray-500 italic">No time slots generated</p>
				{/if}
			</div>

			<!-- Refresh Button -->
			<Button on:click={generateSlots} class="w-full">Regenerate Slots</Button>
		</Card>
	</div>

	<!-- JSON Debug Panel -->
	<Card class="mt-6 p-6">
		<h2 class="mb-4 text-xl font-semibold">Debug Information</h2>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<h3 class="mb-2 text-lg font-medium">UI Recurrence Object</h3>
				<pre class="max-h-64 overflow-x-auto rounded bg-gray-100 p-3 text-xs">{JSON.stringify(
						recurrence,
						null,
						2
					)}</pre>
			</div>

			<div>
				<h3 class="mb-2 text-lg font-medium">RRule Temporal Options</h3>
				<pre class="max-h-64 overflow-x-auto rounded bg-gray-100 p-3 text-xs">{JSON.stringify(
						toRRuleTemporalOptions(recurrence),
						null,
						2
					)}</pre>
			</div>
		</div>
	</Card>
</div>
