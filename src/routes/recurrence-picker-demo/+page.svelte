<script lang="ts">
	export const ssr = false;

	import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
	import {
		toRRules,
		type RecurrenceMulti,
		getRecurrenceMultiDescription,
		generateTimeSlotsMulti
	} from '$lib/components/recurrence/recurrence-utils.js';

	import { Card, Badge, Alert, Tabs, TabItem } from 'flowbite-svelte';
	import { CalendarMonthOutline, ClockOutline, InfoCircleOutline } from 'flowbite-svelte-icons';

	// Demo recurrence configurations
	let currentRecurrence: RecurrenceMulti = {
		frequency: 'weekly',
		interval: 1,
		weekdays: ['MO', 'WE', 'FR'],
		startDate: new Date().toTemporalInstant(),
		endCondition: { type: 'afterCount', count: 5 },
		timeWindows: [{ start: '09:00', end: '10:00' }],
		exceptions: [],
		timezone: 'UTC'
	};

	let generatedSlots: Date[] = [];
	let rruleString = '';
	let description = '';
	let error = '';

	// Preset configurations for quick testing
	const presets: Array<{ name: string; config: RecurrenceMulti }> = [
		{
			name: 'Daily Standup',
			config: {
				frequency: 'daily',
				interval: 1,
				startDate: new Date().toTemporalInstant(),
				endCondition: { type: 'afterCount', count: 10 },
				timeWindows: [{ start: '09:00', end: '09:30' }],
				exceptions: [],
				timezone: 'UTC'
			}
		},
		{
			name: 'Weekly Team Meeting',
			config: {
				frequency: 'weekly',
				interval: 1,
				weekdays: ['TU'],
				startDate: new Date().toTemporalInstant(),
				endCondition: { type: 'never' },
				timeWindows: [{ start: '14:00', end: '15:00' }],
				exceptions: [],
				timezone: 'UTC'
			}
		},
		{
			name: 'Monthly Review',
			config: {
				frequency: 'monthly',
				interval: 1,
				startDate: new Date(
					new Date().getFullYear(),
					new Date().getMonth(),
					15
				).toTemporalInstant(),
				endCondition: {
					type: 'onDate',
					onDate: new Date(new Date().getFullYear() + 1, 11, 31).toTemporalInstant()
				},
				timeWindows: [{ start: '10:00', end: '12:00' }],
				exceptions: [],
				timezone: 'UTC'
			}
		},
		{
			name: 'One-time Event',
			config: {
				frequency: 'once',
				interval: 1,
				startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toTemporalInstant(), // Next week
				endCondition: { type: 'never' },
				timeWindows: [{ start: '18:00', end: '20:00' }],
				exceptions: [],
				timezone: 'UTC'
			}
		}
	];

	function generateSlots() {
		try {
			error = '';

			// Generate time slots using the new multi-window function
			const timeSlots = generateTimeSlotsMulti(currentRecurrence);
			generatedSlots = timeSlots.map((slot) => slot.start);

			// Get the RRULE strings for all time windows
			const rules = toRRules(currentRecurrence);
			rruleString = rules.map((rule) => rule.rruleString).join('\n\n');

			// Get human-readable description
			description = getRecurrenceMultiDescription(currentRecurrence);
		} catch (err) {
			console.error('Error generating slots:', err);
			error = err instanceof Error ? err.message : 'Unknown error occurred';
			generatedSlots = [];
			rruleString = 'Error generating rule';
			description = 'Error in configuration';
		}
	}

	function loadPreset(preset: (typeof presets)[0]) {
		currentRecurrence = { ...preset.config };
		generateSlots();
	}

	// Generate slots when component loads or recurrence changes
	$: if (currentRecurrence) {
		generateSlots();
	}
</script>

<svelte:head>
	<title>RecurrencePicker Demo - CampVotr</title>
	<meta
		name="description"
		content="Interactive demo of the RecurrencePicker component with rrule-temporal integration"
	/>
</svelte:head>

<div class="container mx-auto max-w-7xl p-6">
	<div class="mb-8">
		<h1 class="mb-2 text-4xl font-bold text-gray-900">RecurrencePicker Demo</h1>
		<p class="text-lg text-gray-600">
			Interactive demonstration of the RecurrencePicker component with rrule-temporal integration
		</p>
	</div>

	{#if error}
		<Alert color="red" class="mb-6">
			<div class="flex items-center">
				<InfoCircleOutline class="mr-2 h-4 w-4" />
				<span class="font-medium">Error:</span>
				<span class="ml-1">{error}</span>
			</div>
		</Alert>
	{/if}

	<div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
		<!-- Configuration Panel -->
		<div class="p-4 xl:col-span-1">
			<Card class="h-fit p-5">
				<div class="mb-4 flex items-center gap-2">
					<CalendarMonthOutline class="h-5 w-5 text-blue-600" />
					<h2 class="text-xl font-semibold">Configure Recurrence</h2>
				</div>

				<!-- Preset Buttons -->
				<div class="mb-6">
					<h3 class="mb-2 text-sm font-medium text-gray-700">Quick Presets</h3>
					<div class="grid grid-cols-2 gap-2">
						{#each presets as preset}
							<button
								class="rounded border bg-gray-100 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900"
								on:click={() => loadPreset(preset)}
							>
								{preset.name}
							</button>
						{/each}
					</div>
				</div>

				<!-- Recurrence Picker -->
				<RecurrencePicker bind:value={currentRecurrence} />
			</Card>
		</div>

		<!-- Results Panel -->
		<div class="xl:col-span-2">
			<Tabs style="underline" class="mb-4">
				<TabItem open title="Generated Results">
					<div class="space-y-6">
						<!-- Description -->
						<Card class="p-3">
							<div class="mb-3 flex items-center gap-2">
								<InfoCircleOutline class="h-5 w-5 text-green-600" />
								<h3 class="text-lg font-medium">Description</h3>
							</div>
							<p class="rounded-lg bg-gray-50 p-3 text-gray-700">{description}</p>
						</Card>

						<!-- Generated Time Slots -->
						<Card>
							<div class="mb-3 flex items-center justify-between">
								<div class="flex items-center gap-2">
									<ClockOutline class="h-5 w-5 text-blue-600" />
									<h3 class="text-lg font-medium">Generated Time Slots</h3>
								</div>
								<Badge color="blue" class="text-sm">{generatedSlots.length} slots</Badge>
							</div>

							{#if generatedSlots.length > 0}
								<div class="max-h-96 space-y-2 overflow-y-auto">
									{#each generatedSlots.slice(0, 20) as slot, i}
										<div
											class="flex items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
										>
											<div class="flex flex-col">
												<span class="font-medium text-gray-900">
													{slot.toLocaleDateString('en-US', {
														weekday: 'long',
														year: 'numeric',
														month: 'long',
														day: 'numeric'
													})}
												</span>
												<span class="text-sm text-gray-600">
													{slot.toLocaleTimeString('en-US', {
														hour: '2-digit',
														minute: '2-digit',
														timeZoneName: 'short'
													})}
												</span>
											</div>
											<Badge color="gray" class="text-xs">#{i + 1}</Badge>
										</div>
									{/each}
									{#if generatedSlots.length > 20}
										<div class="py-2 text-center text-sm text-gray-500">
											... and {generatedSlots.length - 20} more slots
										</div>
									{/if}
								</div>
							{:else}
								<p class="py-8 text-center text-gray-500 italic">No time slots generated</p>
							{/if}
						</Card>
					</div>
				</TabItem>

				<TabItem title="Technical Details">
					<div class="space-y-6">
						<!-- RRULE String -->
						<Card>
							<h3 class="mb-3 text-lg font-medium">RRULE String</h3>
							<pre
								class="overflow-x-auto rounded-lg border bg-gray-100 p-4 text-sm whitespace-pre-wrap">{rruleString}</pre>
						</Card>

						<!-- JSON Debug -->
						<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
							<Card>
								<h3 class="mb-3 text-lg font-medium">UI Recurrence Object</h3>
								<pre
									class="max-h-64 overflow-x-auto rounded-lg border bg-gray-100 p-3 text-xs">{JSON.stringify(
										currentRecurrence,
										null,
										2
									)}</pre>
							</Card>

							<Card>
								<h3 class="mb-3 text-lg font-medium">Generated Rules</h3>
								<pre
									class="max-h-64 overflow-x-auto rounded-lg border bg-gray-100 p-3 text-xs">{JSON.stringify(
										toRRules(currentRecurrence),
										null,
										2
									)}</pre>
							</Card>
						</div>
					</div>
				</TabItem>
			</Tabs>
		</div>
	</div>

	<!-- Usage Example -->
	<Card class="mt-8">
		<h2 class="mb-4 text-xl font-semibold">Usage Example</h2>
		<pre class="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code
				>{`import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
import { toRRuleTemporalOptions, generateTimeSlots } from '$lib/components/recurrence/recurrence-utils.js';
import { RRuleTemporal } from 'rrule-temporal';

let recurrence = {
  frequency: 'weekly',
  interval: 1,
  weekdays: ['MO', 'WE', 'FR'],
  startDate: new Date(),
  endCondition: { type: 'afterCount', count: 5 },
  timeRange: { start: '09:00', end: '10:00' },
  exceptions: [],
  timezone: 'UTC'
};

// Generate time slots
const timeSlots = generateTimeSlots(recurrence);

// Or use rrule-temporal directly
const rruleOptions = toRRuleTemporalOptions(recurrence);
const rule = new RRuleTemporal(rruleOptions);
const occurrences = rule.all();`}</code
			></pre>
	</Card>
</div>
