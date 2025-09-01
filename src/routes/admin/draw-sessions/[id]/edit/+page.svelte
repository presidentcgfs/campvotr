<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Schedules from '$lib/components/schedules/Schedules.svelte';
	import type { ScheduleUI } from '$lib/components/schedules/types.js';
	import { Button, Input } from 'flowbite-svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';

	let { data } = $props<{ data: PageData }>();
	// Initialize schedules - start with one empty schedule
	let schedules = $state((data.draw.schedules ?? []) as ScheduleUI[]);
	let draw = $state<{
		name: string;
		startsAtUtc: Date;
		pickTimeoutSec: number;
		turnStrategy: string;
		rounds: number;
	}>(data.draw);

	function addSchedule() {
		schedules.push({
			fieldIds: [],
			recurrence: {
				frequency: 'once',
				interval: 1,
				startDate: new Date(),
				endCondition: { type: 'afterCount', count: 1 },
				timeWindows: [{ start: '09:00', end: '10:00' }],
				exceptions: [],
				timezone: 'UTC'
			}
		});
	}
	function cancel() {
		goto('/admin/draw-sessions');
	}
</script>

<div class="container space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">Edit Draw Session</h1>
		<Button type="button" color="secondary">Cancel</Button>
	</div>

	{#if $page.form?.error}
		<div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
			{$page.form.error}
		</div>
	{/if}

	{#if $page.form?.success}
		<div class="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
			Session updated successfully!
		</div>
	{/if}

	<form method="POST" class="space-y-6">
		<input type="hidden" name="id" value={data.session?.id} />

		<!-- Basic Session Info -->
		<div class="card">
			<h2 class="mb-4 text-xl font-semibold">Session Details</h2>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="name" class="block text-sm font-medium text-gray-700">Session Name</label>
					<Input type="text" id="name" name="name" bind:value={draw.name} required />
				</div>

				<div>
					<label for="turnStrategy" class="block text-sm font-medium text-gray-700"
						>Turn Strategy</label
					>
					<select
						id="turnStrategy"
						name="turnStrategy"
						bind:value={draw.turnStrategy}
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					>
						<option value="fixed">Fixed Order</option>
						<option value="randomized">Randomized</option>
						<option value="snake">Snake Draft</option>
					</select>
				</div>

				<div>
					<label for="rounds" class="block text-sm font-medium text-gray-700"
						>Rounds (optional)</label
					>
					<Input
						type="number"
						id="rounds"
						name="rounds"
						bind:value={draw.rounds}
						placeholder="Unlimited"
						min="1"
					/>
				</div>

				<div>
					<label for="pickTimeoutSec" class="block text-sm font-medium text-gray-700"
						>Pick Timeout (seconds)</label
					>
					<Input
						type="number"
						id="pickTimeoutSec"
						name="pickTimeoutSec"
						bind:value={draw.pickTimeoutSec}
						min="10"
						max="3600"
						required
					/>
				</div>

				<div class="md:col-span-2">
					<label for="startsAtUtc" class="block text-sm font-medium text-gray-700"
						>Start Time (UTC)</label
					>
					<input
						type="datetime-local"
						id="startsAtUtc"
						name="startsAtUtc"
						bind:value={draw.startsAtUtc}
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
				</div>
			</div>
		</div>

		<!-- Schedule Configuration -->
		<div class="card">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-semibold">Schedule Configuration</h2>
				<Button type="button" size="sm" onclick={addSchedule}>
					<PlusOutline class="mr-2 h-4 w-4" />
					Add Schedule
				</Button>
			</div>

			<div class="mb-6">
				{#if data.fields?.length}
					<Schedules path="draw.schedules" bind:schedules fields={data.fields} />
				{:else}
					<p class="text-gray-600">No fields available. Please create fields first.</p>
				{/if}
			</div>

			<!-- Submit Buttons -->
			<div class="flex justify-end gap-4">
				<Button onclick={cancel} color="secondary">Cancel</Button>
				<Button type="submit" color="primary">Update Session</Button>
			</div>
		</div>
	</form>
</div>
