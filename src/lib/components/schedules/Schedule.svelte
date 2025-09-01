<script lang="ts">
	import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
	import { MultiSelect } from 'flowbite-svelte';
	import { getRecurrenceMultiDescription } from '$lib/components/recurrence/recurrence-utils.js';

	import type { Field, ScheduleUI } from './types';
	import type { EndCondition } from '$lib/schemas/draw-session-schema';
	let {
		schedule: _schedule = $bindable(),
		path,
		fields = $bindable(),
		allowedEndConditions = ['afterCount', 'onDate']
	} = $props<{
		schedule: ScheduleUI;
		fields: Field[];
		path: string;
		allowedEndConditions?: EndCondition['type'][];
	}>();

	let items = $derived(fields.map((f: any) => ({ value: f.id, name: f.name })));
	let fieldMap = $derived(new Map<string, Field>(fields.map((f: Field) => [f.id, f])));
	let schedule = $state(_schedule);

	let fieldIds = $derived(schedule.fieldIds);
	$effect(() => {
		schedule.fields = fieldIds.map((id: string) => fieldMap.get(id)!);
		schedule.fieldIds = fieldIds;
	});
	$effect(() => {
		_schedule = schedule;
	});
</script>

<div class="space-y-4">
	<div>
		<label for="fields-{path}" class="mb-2 block text-sm font-medium">Target Fields</label>
		<MultiSelect
			id="fields-{path}"
			name="{path}.fieldIds"
			{items}
			bind:value={fieldIds}
			placeholder="Select fields for this schedule"
			class="w-full"
		/>
	</div>

	<div>
		<RecurrencePicker {allowedEndConditions} bind:value={schedule.recurrence} />
	</div>

	<div class="rounded bg-gray-50 p-3 text-sm">
		<strong>Preview:</strong>
		{getRecurrenceMultiDescription(schedule.recurrence)}
	</div>
</div>
