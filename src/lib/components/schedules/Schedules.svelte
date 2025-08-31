<script lang="ts">
	import { Accordion, AccordionItem, Button } from 'flowbite-svelte';
	import type { Field, ScheduleUI } from './types';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import Schedule from './Schedule.svelte';
	import { dayOrder, dayNames, deriveScheduleTitle } from './util.js';

	let {
		schedules = $bindable(),
		fields,
		path = 'draw'
	} = $props<{
		schedules: ScheduleUI[];
		fields: Field[];
		path: string;
	}>();

	$effect(() => {
		console.log('Schedules changed:', schedules);
	});
	let fieldMap = $derived(new Map<string, Field>(fields.map((f: Field) => [f.id, f])));

	function removeScheduleUI(idx: number) {
		schedules = [...schedules.slice(0, idx), ...schedules.slice(idx + 1)];
	}
</script>

<Accordion>
	{#each schedules as schedule, si}
		<AccordionItem open={si === 0}>
			{#snippet header()}
				<span class="flex w-full items-center justify-between">
					<span class="text-sm font-medium">
						{deriveScheduleTitle(schedule, fieldMap) || `Schedule ${si + 1}`}
					</span>
					<div class="flex items-center gap-2">
						{#if schedules.length > 1}
							<Button
								type="button"
								pill
								outline
								color="red"
								size="xs"
								class="p-2!"
								onclick={() => removeScheduleUI(si)}
							>
								<TrashBinOutline size="xs" />
							</Button>
						{/if}
					</div>
				</span>
			{/snippet}
			<Schedule bind:schedule={schedules[si]} {fields} path={`${path}.schedules[${si}]`} />
		</AccordionItem>
	{/each}
</Accordion>
