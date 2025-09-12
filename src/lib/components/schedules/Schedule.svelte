<script lang="ts">
	import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
	import { Alert, MultiSelect } from 'flowbite-svelte';
	import { getRecurrenceMultiDescription } from '$lib/components/recurrence/recurrence-utils.js';

	import type { Field, ScheduleUI } from './types';
	import type { EndCondition } from '$lib/schemas/draw-session-schemas';
	let {
		schedule = $bindable(),
		path,
		fields = $bindable(),
		allowedEndConditions = ['afterCount', 'onDate'],
		errors
	} = $props<{
		schedule: ScheduleUI;
		fields: Field[];
		path: string;
		allowedEndConditions?: EndCondition['type'][];
		errors?: string[];
	}>();

	let items = $derived(fields.map((f: any) => ({ value: f.id, name: f.name })));
	let fieldMap = $derived(new Map<string, Field>(fields.map((f: Field) => [f.id, f])));

	// Sync fieldIds changes back to schedule
	$effect(() => {
		schedule.fields = schedule.fieldIds.map((id: string) => fieldMap.get(id)!);
	});
</script>

<div class="space-y-4">
	<div>
		<label for="fields-{path}" class="mb-2 block text-sm font-medium">Target Fields</label>
		{#if errors?.length}
			<Alert color="red">{errors.join(', ')}</Alert>
		{/if}
		<MultiSelect
			id="fields-{path}"
			{items}
			bind:value={schedule.fieldIds}
			placeholder="Select fields for this schedule"
			class="w-full"
		/>
		{#each schedule.fieldIds as id, index}
			<input type="hidden" name="{path}.fieldIds[{index}]" value={id} />
		{/each}
		<input type="hidden" name="{path}.id" value={schedule.id} />
	</div>
	<div>
		<RecurrencePicker
			{allowedEndConditions}
			path="{path}.recurrence"
			bind:value={schedule.recurrence}
		/>
	</div>

	<div class="rounded bg-gray-50 p-3 text-sm">
		<strong>Preview:</strong>
		{getRecurrenceMultiDescription(schedule.recurrence)}
	</div>
</div>
