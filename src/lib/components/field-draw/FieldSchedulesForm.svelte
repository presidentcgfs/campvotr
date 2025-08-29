<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import RecurrencePicker from '$lib/components/recurrence/RecurrencePicker.svelte';
	import {
		Button,
		MultiSelect,
		Accordion,
		AccordionItem,
		Timepicker,
		Datepicker,
		Select,
		Input,
		Textarea
	} from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import {
		type RecurrenceMulti,
		toRRules,
		generateTimeSlotsMulti,
		getRecurrenceMultiDescription
	} from '$lib/components/recurrence/recurrence-utils.js';
	import type { PageData } from '../../../routes/admin/draw-sessions/$types';
	export let data: PageData; // expects { orgId, fields, sessions }

	// Form state
	let name = '';
	let turnStrategy = 'snake';
	let startDate = new Date();
	let endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
	let participantsText = '';

	// Schedule management

	$: fieldSelectItems = (data.fields || []).map((f: any) => ({ value: f.id, name: f.name }));

	// Draw-level schedules using RecurrenceMulti (each can target multiple Fields)
	type ScheduleUI = {
		recurrence: RecurrenceMulti;
		fieldIds: string[];
		collapsed?: boolean;
	};
	function createDefaultScheduleUI(): ScheduleUI {
		return {
			recurrence: {
				frequency: 'weekly',
				interval: 1,
				weekdays: ['MO', 'TU', 'WE', 'TH', 'FR'],
				endCondition: { type: 'onDate', onDate: new Date(endDate).toTemporalInstant() },
				timeWindows: [{ start: '09:00', end: '10:00' }],
				startDate: new Date(startDate).toTemporalInstant()
			},
			fieldIds: [],
			collapsed: false
		};
	}

	let schedules: ScheduleUI[] = [createDefaultScheduleUI()];

	function addScheduleUI() {
		schedules = [...schedules, createDefaultScheduleUI()];
	}
	function removeScheduleUI(idx: number) {
		schedules.splice(idx, 1);
		if (schedules.length === 0) schedules = [createDefaultScheduleUI()];
		else schedules = [...schedules];
	}

	// Updated functions for RecurrenceMulti-based schedules
	function calculateScheduleSlots(recurrence: RecurrenceMulti): number {
		try {
			const timeSlots = generateTimeSlotsMulti(recurrence);
			return timeSlots.length;
		} catch (error) {
			console.warn('Error calculating schedule slots:', error);
			return 0;
		}
	}

	// Title helpers (top-level) for schedule-centric UI
	function labelFields(ids: string[]): string {
		const names = (ids || []).map((id) => data.fields?.find((f: any) => f.id === id)?.name || id);
		if (names.length === 0) return '';
		if (names.length <= 2) return names.join(', ');
		return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
	}

	function deriveScheduleTitle(sch: ScheduleUI): string {
		const f = labelFields(sch.fieldIds);
		const description = getRecurrenceMultiDescription(sch.recurrence);
		return [f, description].filter(Boolean).join(' - ');
	}

	// Confirmation modal
	let confirmOpen = false;
	let submitError: string | null = null;
	let submitting = false;

	async function handleSubmit() {
		if (submitting) return;
		submitting = true;
		submitError = null;

		try {
			// Validate basic fields
			if (!name.trim()) throw new Error('Name is required');
			if (!startDate || !endDate) throw new Error('Start and end dates are required');
			if (new Date(endDate) < new Date(startDate))
				throw new Error('End date must be after start date');

			// Validate participants
			const participants = participantsText
				.split('\n')
				.map((line) => line.trim())
				.filter(Boolean);
			if (participants.length > 200) throw new Error('Maximum 200 participants allowed');

			// Validate schedules
			if (schedules.length === 0) throw new Error('At least one schedule is required');
			for (const sch of schedules) {
				if (sch.fieldIds.length === 0)
					throw new Error('Each schedule must target at least one field');
			}

			// Build submission payload
			const drawSchedules = schedules.map((sch) => ({
				fieldIds: sch.fieldIds,
				recurrence: sch.recurrence,
				rules: toRRules(sch.recurrence)
			}));

			const payload = {
				name: name.trim(),
				turnStrategy,
				startDate,
				endDate,
				participants,
				schedules: drawSchedules
			};

			console.log('Submitting draw session:', payload);

			const response = await fetch('/api/admin/draw-sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `HTTP ${response.status}`);
			}

			const result = await response.json();
			console.log('Draw session created:', result);

			// Reset form or redirect
			confirmOpen = false;
			// You might want to redirect or emit an event here
		} catch (error) {
			console.error('Submit error:', error);
			submitError = error instanceof Error ? error.message : 'An unexpected error occurred';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="card space-y-3">
		<h2 class="text-lg font-semibold">Basic Information</h2>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<label class="text-sm">
				<span class="mb-1 block">Name</span>
				<Input
					value={name}
					placeholder="Draw Session Name"
					onchange={(e) => (name = (e.target as HTMLInputElement).value)}
				/>
			</label>
			<label class="text-sm">
				<span class="mb-1 block">Turn Strategy</span>
				<Select
					items={[
						{ value: 'random', name: 'Random' },
						{ value: 'round_robin', name: 'Round Robin' },
						{ value: 'snake', name: 'Snake' }
					]}
					bind:value={turnStrategy}
				/>
			</label>
		</div>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
			<label for="date-range" class="text-sm">
				<span class="mb-1 block">Date Range</span>
				<Datepicker id="date-range" range bind:rangeFrom={startDate} bind:rangeTo={endDate} />
			</label>
		</div>
	</div>

	<div class="card space-y-3">
		<h2 class="text-lg font-semibold">Participants</h2>
		<label class="text-sm">
			<span class="mb-1 block">Participant Emails (one per line)</span>
			<Textarea
				class="w-full rounded border px-3 py-2"
				rows={6}
				placeholder="user@example.com&#10;another@example.com"
				bind:value={participantsText}
			/>
			<p class="mt-1 text-xs text-gray-600">
				Max 200; only members of this organization are allowed.
			</p>
		</label>
	</div>

	<div class="card space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold">Schedules</h2>
		</div>

		<Accordion>
			{#each schedules as sch, si}
				<AccordionItem open={si === 0}>
					{#snippet header()}
						<span class="flex w-full items-center justify-between">
							<span class="text-sm font-medium">
								{deriveScheduleTitle(sch) || `Schedule ${si + 1}`}
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
					<div class="space-y-4">
						<div>
							<label for="fields-{si}" class="mb-2 block text-sm font-medium">Target Fields</label>
							<MultiSelect
								id="fields-{si}"
								items={fieldSelectItems}
								bind:value={sch.fieldIds}
								placeholder="Select fields for this schedule"
								class="w-full"
							/>
						</div>

						<div>
							<RecurrencePicker
								allowedEndConditions={['afterCount', 'onDate']}
								value={sch.recurrence}
							/>
						</div>

						<div class="rounded bg-gray-50 p-3 text-sm">
							<strong>Preview:</strong>
							{getRecurrenceMultiDescription(sch.recurrence)}
						</div>
					</div>
				</AccordionItem>
			{/each}
		</Accordion>
		<Button type="button" class="btn btn-secondary btn-sm" onclick={addScheduleUI}
			>Add schedule</Button
		>

		<!-- Field-specific schedules section removed - now using unified RecurrencePicker approach -->

		<div class="flex items-center justify-between">
			<div class="text-sm text-gray-600">
				This preview is an estimate; final validation and overlaps against existing slots are
				enforced server-side.
			</div>
		</div>
	</div>

	<div class="flex justify-end gap-3">
		<Button type="button" onclick={() => (confirmOpen = true)}>Create Draw Session</Button>
	</div>
</div>

<Modal bind:open={confirmOpen} title="Confirm Draw Session Creation">
	<div class="space-y-4">
		<p>You are about to create a draw session with slots across all fields and schedules.</p>
		<div class="text-sm text-gray-600">
			<p><strong>Name:</strong> {name}</p>
			<p><strong>Strategy:</strong> {turnStrategy}</p>
			<p><strong>Date Range:</strong> {startDate} to {endDate}</p>
			<p>
				<strong>Participants:</strong>
				{participantsText.split('\n').filter(Boolean).length}
			</p>
			<p><strong>Schedules:</strong> {schedules.length}</p>
		</div>
		{#if submitError}
			<div class="rounded bg-red-50 p-3 text-sm text-red-700">
				{submitError}
			</div>
		{/if}
	</div>
	<div slot="footer" class="flex justify-end gap-3">
		<Button type="button" color="alternative" onclick={() => (confirmOpen = false)}>Cancel</Button>
		<Button type="button" onclick={handleSubmit} disabled={submitting}>
			{submitting ? 'Creating...' : 'Create'}
		</Button>
	</div>
</Modal>
