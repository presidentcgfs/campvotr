<script lang="ts">
	import Modal from '$lib/components/Modal.svelte';
	import DateRange from '$lib/components/DateRange.svelte';
	import { Button, Timepicker, MultiSelect, Accordion, AccordionItem } from 'flowbite-svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';

	import type { PageData } from '../../../routes/admin/draw-sessions/$types';
	export let data: PageData; // expects { orgId, fields, sessions }

	// Session meta
	let name = '';
	let turnStrategy: 'fixed' | 'randomized' | 'snake' = 'fixed';
	let rounds: number | '' = '';
	let pickTimeoutSec = 60;
	let startsAtUtc = '';
	let participantsText = '';

	// Fields selection and per-field schedules
	type TimeWindow = { start: string; end: string };
	type FieldSchedule = {
		startDate: Date; // YYYY-MM-DD (UTC)
		endDate: Date; // YYYY-MM-DD (UTC)
		days: Set<string>; // e.g., MO,TU,WE
		windows: TimeWindow[]; // HH:mm
	};
	const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

	let selectedFieldIds: string[] = [];
	let schedulesByField: Record<string, FieldSchedule[]> = {};
	let collapsed: Record<string, boolean> = {};
	let openSchedule = 0;
	function toggleCollapse(fid: string) {
		collapsed[fid] = !collapsed[fid];
		collapsed = { ...collapsed };
	}
	function addMinutes(hhmm: string, minutes: number): string {
		const [hStr, mStr] = (hhmm || '00:00').split(':');
		const h = Number(hStr) || 0;
		const m = Number(mStr) || 0;
		let total = h * 60 + m + minutes;
		if (total >= 24 * 60) total = 23 * 60 + 59; // clamp; no over-midnight
		const hh = String(Math.floor(total / 60)).padStart(2, '0');
		const mm = String(total % 60).padStart(2, '0');
		return `${hh}:${mm}`;
	}
	function onStartInput(fid: string, si: number, wi: number) {
		const sch = schedulesByField[fid]?.[si];
		if (!sch) return;
		const w = sch.windows[wi];
		if (!w) return;
		if (w.start) {
			const dur = previousDurationMinutes(sch, wi);
			w.end = addMinutes(w.start, dur);
			// Propagate: next window starts at this end, keeping same duration
			const next = sch.windows[wi + 1];
			if (next) {
				next.start = w.end;
				next.end = addMinutes(next.start, dur);
			}
			schedulesByField = { ...schedulesByField };
		}
	}

	function toggleField(fid: string) {
		if (selectedFieldIds.includes(fid)) {
			selectedFieldIds = selectedFieldIds.filter((x) => x !== fid);
			delete schedulesByField[fid];
			schedulesByField = { ...schedulesByField };
		} else {
			selectedFieldIds = [...selectedFieldIds, fid];
			if (!schedulesByField[fid]) {
				schedulesByField[fid] = [createDefaultSchedule()];
				schedulesByField = { ...schedulesByField };
			}
		}
	}

	function createDefaultSchedule(): FieldSchedule {
		return {
			startDate,
			endDate,
			days: new Set(['MO', 'TU', 'WE', 'TH', 'FR']),
			windows: [{ start: '', end: '' }]
		};
	}

	function cloneSchedule(s: FieldSchedule): FieldSchedule {
		return {
			startDate: s.startDate,
			endDate: s.endDate,
			days: new Set(Array.from(s.days || [])),
			windows: (s.windows || []).map((w) => ({ start: w.start, end: w.end }))
		};
	}
	function copyScheduleToOthers(sourceFid: string, si: number) {
		const sch = schedulesByField[sourceFid]?.[si];
		if (!sch) return;
		const others = selectedFieldIds.filter((fid) => fid !== sourceFid);
		for (const fid of others) {
			(schedulesByField[fid] ||= []).push(cloneSchedule(sch));
		}
		schedulesByField = { ...schedulesByField };
	}

	function addSchedule(fid: string) {
		(schedulesByField[fid] ||= []).push(createDefaultSchedule());
		schedulesByField = { ...schedulesByField };
	}
	function removeSchedule(fid: string, idx: number) {
		const arr = schedulesByField[fid] || [];
		arr.splice(idx, 1);
		if (arr.length === 0) arr.push(createDefaultSchedule());
		schedulesByField = { ...schedulesByField };
	}
	function addWindow(fid: string, si: number) {
		const sch = schedulesByField[fid]?.[si];
		if (!sch) return;
		const last = sch.windows[sch.windows.length - 1];
		const start = last && timeRe.test(last.end) ? last.end : '00:00';
		const dur = previousDurationMinutes(sch);
		const end = addMinutes(start, dur);
		sch.windows.push({ start, end });
		schedulesByField = { ...schedulesByField };
	}
	function removeWindow(fid: string, si: number, wi: number) {
		const sch = schedulesByField[fid]?.[si];
		if (!sch) return;
		sch.windows.splice(wi, 1);
		if (sch.windows.length === 0) sch.windows.push({ start: '', end: '' });
	}
	function setPresetDays(sch: FieldSchedule, preset: 'weekdays' | 'weekends' | 'monfri') {
		if (preset === 'weekdays' || preset === 'monfri')
			sch.days = new Set(['MO', 'TU', 'WE', 'TH', 'FR']);
		else if (preset === 'weekends') sch.days = new Set(['SA', 'SU']);
		schedulesByField = { ...schedulesByField };
	}
	function toggleDay(sch: FieldSchedule, code: string) {
		if (sch.days.has(code)) sch.days.delete(code);
		else sch.days.add(code);
		sch.days = new Set(sch.days);
		schedulesByField = { ...schedulesByField };
	}

	// Inline validation helpers
	const timeRe = /^\d{2}:\d{2}$/;
	function toMinutes(hhmm: string): number {
		const [h, m] = hhmm.split(':').map((n) => Number(n || 0));
		return h * 60 + m;
	}
	function minutesBetween(start: string, end: string): number {
		if (!timeRe.test(start) || !timeRe.test(end)) return 0;
		return toMinutes(end) - toMinutes(start);
	}
	function previousDurationMinutes(
		sch: { windows: { start: string; end: string }[] },
		wi?: number
	): number {
		const def = 60;
		const wins = sch.windows || [];
		// try current window's duration
		if (wi != null) {
			const w = wins[wi];
			if (w && timeRe.test(w.start) && timeRe.test(w.end)) {
				const d = minutesBetween(w.start, w.end);
				if (d > 0) return d;
			}
		}
		// look backwards for last valid duration
		for (let i = wi != null ? wi - 1 : wins.length - 1; i >= 0; i--) {
			const w = wins[i];
			if (w && timeRe.test(w.start) && timeRe.test(w.end)) {
				const d = minutesBetween(w.start, w.end);
				if (d > 0) return d;
			}
		}
		return def;
	}

	function validateSchedule(sch: FieldSchedule): string | null {
		if (!sch.startDate || !sch.endDate) return 'Start and end dates are required (UTC)';
		if (!sch.days || sch.days.size === 0) return 'Select at least one day';
		if (!sch.windows.length) return 'Add at least one time window';
		const mins = sch.windows.map((w) => ({
			st: toMinutes(w.start),
			en: toMinutes(w.end),
			ok: timeRe.test(w.start) && timeRe.test(w.end)
		}));
		if (mins.some((m) => !m.ok)) return 'Times must be HH:mm (UTC)';
		if (mins.some((m) => !(m.en > m.st))) return 'End must be after start (no over‑midnight)';
		mins.sort((a, b) => a.st - b.st);
		for (let i = 1; i < mins.length; i++)
			if (mins[i - 1].en > mins[i].st) return 'Time windows overlap within the schedule';
		const s = sch.startDate;
		const e = sch.endDate;
		if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s)
			return 'End date must be on/after start (UTC)';
		return null;
	}

	function calculateScheduleSlots(sch: FieldSchedule): number {
		const err = validateSchedule(sch);
		if (err) return 0;
		const s = sch.startDate;
		const e = sch.endDate;
		let days = 0;
		for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
			const code = DAY_CODES[d.getUTCDay()];
			if (sch.days.has(code)) days++;
		}
		return days * sch.windows.length;
	}

	$: perFieldEstimates = Object.fromEntries(
		(data.fields || []).map((f: any) => {
			const total = (schedules || []).reduce((n, sch) => {
				// Helpers to derive readable schedule titles
				function fieldsLabel(ids: string[]): string {
					const names = (ids || []).map(
						(id) => data.fields?.find((f: any) => f.id === id)?.name || id
					);
					if (names.length === 0) return '';
					if (names.length <= 2) return names.join(', ');
					return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
				}
				function daysLabelFromSet(days: Set<string>): string {
					const arr = Array.from(days || []);
					const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR'];
					const weekends = ['SA', 'SU'];
					const same = (a: string[], b: string[]) =>
						a.length === b.length && a.every((x) => b.includes(x));
					const sorted = [...arr].sort();
					if (sorted.length === 7) return 'Daily';
					if (same(sorted, weekdays)) return 'Weekdays';
					if (same(sorted, weekends)) return 'Weekends';
					return sorted.join(',');
				}
				function timeLabelFromWindows(windows: TimeWindow[]): string {
					const wins = (windows || [])
						.filter((w) => w.start && w.end)
						.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
					if (wins.length === 0) return '';
					let contiguous = true;
					for (let i = 1; i < wins.length; i++) {
						if (wins[i].start !== wins[i - 1].end) {
							contiguous = false;
							break;
						}
					}
					if (contiguous) {
						const first = wins[0].start;
						const last = wins[wins.length - 1].end;
						if (first === '00:00' && (last === '23:59' || last === '24:00')) return 'all day';
						return `${first} ${last}`.replace('\u0003', '–');
					}
					return wins.map((w) => `${w.start} ${w.end}`.replace('\u0003', '–')).join(', ');
				}
				function scheduleTitle(sch: ScheduleUI): string {
					const f = fieldsLabel(sch.fieldIds);
					const d = daysLabelFromSet(sch.days);
					const t = timeLabelFromWindows(sch.windows);
					return [f, d, t].filter(Boolean).join(' ');
				}
				function scheduleSubTitleField(sch: FieldSchedule): string {
					const d = daysLabelFromSet(sch.days);
					const t = timeLabelFromWindows(sch.windows);
					return [d, t].filter(Boolean).join(' ');
				}

				if (!sch.fieldIds?.includes(f.id)) return n;
				return (
					n +
					calculateScheduleSlots({
						startDate: sch.startDate,
						endDate: sch.endDate,
						days: sch.days,
						windows: sch.windows
					} as any)
				);
			}, 0);
			return [f.id, total];
		})
	);
	$: aggregateEstimate = Object.values(perFieldEstimates).reduce(
		(a: number, b: number) => a + b,
		0
	);

	$: fieldSelectItems = (data.fields || []).map((f: any) => ({ value: f.id, name: f.name }));

	function getFieldName(fid: string) {
		return data.fields?.find((f: any) => f.id === fid)?.name || fid;
	}

	// Draw-level schedules (each can target multiple Fields)
	type ScheduleUI = {
		startDate: Date;
		endDate: Date;
		days: Set<string>;
		windows: TimeWindow[];
		fieldIds: string[];
		collapsed?: boolean;
	};
	function createDefaultScheduleUI(): ScheduleUI {
		return {
			startDate,
			endDate,
			days: new Set(['MO', 'TU', 'WE', 'TH', 'FR']),
			windows: [{ start: '', end: '' }],
			fieldIds: [],
			collapsed: false
		};
	}
	let schedules: ScheduleUI[] = [createDefaultScheduleUI()];
	function addScheduleUI() {
		openSchedule = schedules.length;
		schedules = [...schedules, createDefaultScheduleUI()];
	}
	function removeScheduleUI(index: number) {
		schedules.splice(index, 1);
		if (schedules.length === 0) schedules = [createDefaultScheduleUI()];
		else schedules = [...schedules];
	}
	function addWindowGlobal(si: number) {
		const sch = schedules[si];
		if (!sch) return;
		const last = sch.windows[sch.windows.length - 1];
		const start = last && timeRe.test(last.end) ? last.end : '00:00';
		const dur = previousDurationMinutes(sch);
		const end = addMinutes(start, dur);
		sch.windows.push({ start, end });
		schedules = [...schedules];
	}
	function removeWindowGlobal(si: number, wi: number) {
		const sch = schedules[si];
		if (!sch) return;
		sch.windows.splice(wi, 1);
		if (sch.windows.length === 0) sch.windows.push({ start: '', end: '' });
		schedules = [...schedules];
	}
	function toggleDaySchedule(sch: ScheduleUI, code: string) {
		if (sch.days.has(code)) sch.days.delete(code);
		else sch.days.add(code);
		sch.days = new Set(sch.days);
		schedules = [...schedules];
	}
	function setPresetDaysSchedule(sch: ScheduleUI, preset: 'weekdays' | 'weekends' | 'monfri') {
		if (preset === 'weekdays' || preset === 'monfri')
			sch.days = new Set(['MO', 'TU', 'WE', 'TH', 'FR']);
		else if (preset === 'weekends') sch.days = new Set(['SA', 'SU']);
		schedules = [...schedules];
	}
	function toggleFieldForSchedule(si: number, fid: string) {
		const sch = schedules[si];
		if (!sch) return;
		sch.fieldIds = sch.fieldIds.includes(fid)
			? sch.fieldIds.filter((x) => x !== fid)
			: [...sch.fieldIds, fid];
		schedules = [...schedules];
	}
	function onStartInputGlobal(si: number, wi: number) {
		const sch = schedules[si];
		if (!sch) return;
		const w = sch.windows[wi];
		if (!w) return;
		if (w.start && (!w.end || !/^\d{2}:\d{2}$/.test(w.end))) {
			const dur = previousDurationMinutes(sch, wi);
			w.end = addMinutes(w.start, dur);
			schedules = [...schedules];
		}
	}

	// Title helpers (top-level) for schedule-centric UI
	function labelFields(ids: string[]): string {
		const names = (ids || []).map((id) => data.fields?.find((f: any) => f.id === id)?.name || id);
		if (names.length === 0) return '';
		if (names.length <= 2) return names.join(', ');
		return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
	}
	function labelDays(days: Set<string>): string {
		const arr = Array.from(days || []);
		const weekdays = ['MO', 'TU', 'WE', 'TH', 'FR'];
		const weekends = ['SA', 'SU'];
		const same = (a: string[], b: string[]) =>
			a.length === b.length && a.every((x) => b.includes(x));
		const sorted = [...arr].sort();
		if (sorted.length === 7) return 'Daily';
		if (same(sorted, weekdays)) return 'Weekdays';
		if (same(sorted, weekends)) return 'Weekends';
		return sorted.join(',');
	}
	function labelTimes(windows: TimeWindow[]): string {
		const wins = (windows || [])
			.filter((w) => w.start && w.end)
			.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
		if (wins.length === 0) return '';
		let contiguous = true;
		for (let i = 1; i < wins.length; i++) {
			if (wins[i].start !== wins[i - 1].end) {
				contiguous = false;
				break;
			}
		}
		if (contiguous) {
			const first = wins[0].start;
			const last = wins[wins.length - 1].end;
			if (first === '00:00' && (last === '23:59' || last === '24:00')) return 'all day';
			return `${first}–${last}`;
		}
		return wins.map((w) => `${w.start}–${w.end}`).join(', ');
	}
	function deriveScheduleTitle(sch: ScheduleUI): string {
		const f = labelFields(sch.fieldIds);
		const d = labelDays(sch.days);
		const t = labelTimes(sch.windows);
		return [f, d, t].filter(Boolean).join(' ');
	}
	function deriveFieldScheduleTitle(sch: FieldSchedule): string {
		const d = labelDays(sch.days);
		const t = labelTimes(sch.windows);
		return [d, t].filter(Boolean).join(' ');
	}

	// Confirmation modal
	let confirmOpen = false;
	let submitError: string | null = null;
	let submitting = false;
	function openConfirm() {
		submitError = null;
		confirmOpen = true;
	}

	async function submitConfirmed() {
		submitting = true;
		submitError = null;
		try {
			const participants = participantsText
				.split(/\r?\n|,/)
				.map((s) => s.trim())
				.filter(Boolean);
			const drawSchedules = (schedules || [])
				.map((sch) => ({
					fieldIds: sch.fieldIds,
					startDate: sch.startDate,
					endDate: sch.endDate,
					days: Array.from(sch.days),
					windows: sch.windows.map((w) => ({ startTime: w.start, endTime: w.end }))
				}))
				.filter((s) => (s.fieldIds || []).length > 0);
			const res = await fetch('/api/draw-sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name,
					turnStrategy,
					rounds: rounds === '' ? null : Number(rounds),
					pickTimeoutSec: Number(pickTimeoutSec || 60),
					startsAtUtc: startsAtUtc ? `${startsAtUtc}:00Z` : null,
					participants,
					drawSchedules
				})
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json?.error || 'Failed to create');
			// Reset minimal state
			name = '';
			turnStrategy = 'fixed';
			rounds = '';
			pickTimeoutSec = 60;
			startsAtUtc = '';
			participantsText = '';
			schedules = [createDefaultScheduleUI()];
			confirmOpen = false;
			// Optional: trigger reload
			location.reload();
		} catch (e: any) {
			submitError = String(e?.message || e);
		} finally {
			submitting = false;
		}
	}
	$: startDate = new Date();
	$: endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
</script>

<div class="space-y-6">
	<div class="card">
		<h2 class="mb-4 text-xl font-semibold">Create Draw Session</h2>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<label class="text-sm">
				<span class="mb-1 block">Name</span>
				<input class="w-full rounded border px-3 py-2" bind:value={name} />
			</label>
			<label class="text-sm">
				<span class="mb-1 block">Turn Strategy</span>
				<select class="w-full rounded border px-3 py-2" bind:value={turnStrategy}>
					<option value="fixed">Fixed</option>
					<option value="randomized">Randomized</option>
					<option value="snake">Snake</option>
				</select>
			</label>
			<label class="text-sm">
				<span class="mb-1 block">Rounds (optional)</span>
				<input class="w-full rounded border px-3 py-2" type="number" min="1" bind:value={rounds} />
			</label>
			<label class="text-sm">
				<span class="mb-1 block">Pick Timeout (sec)</span>
				<input
					class="w-full rounded border px-3 py-2"
					type="number"
					min="5"
					bind:value={pickTimeoutSec}
				/>
			</label>
			<label class="text-sm">
				<span class="mb-1 block">Starts At (UTC)</span>
				<input
					class="w-full rounded border px-3 py-2"
					type="datetime-local"
					bind:value={startsAtUtc}
				/>
			</label>
			<div class="md:col-span-2">
				<DateRange bind:startDate bind:endDate />
			</div>

			<label class="text-sm md:col-span-2">
				<span class="mb-1 block">Participants (email or email:role, one per line)</span>
				<textarea
					class="w-full rounded border px-3 py-2"
					rows="4"
					bind:value={participantsText}
					placeholder="alice@example.com\nbob@example.com:captain"
				></textarea>
				<p class="mt-1 text-xs text-gray-600">
					Max 200; only members of this organization are allowed.
				</p>
			</label>
		</div>
	</div>

	<div class="card space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold">Schedules</h3>
			<span class="text-sm text-gray-600">Projected total: {aggregateEstimate}</span>
		</div>

		<Accordion>
			{#each schedules as sch, si}
				<AccordionItem open={si === openSchedule}>
					{#snippet header()}{(deriveScheduleTitle(sch) || `Schedule ${si + 1}`) + ' '}{/snippet}
					<div class="mb-2 flex items-center justify-end">
						{#if schedules.length > 1}
							<Button
								outline
								type="button"
								size="xs"
								color="red"
								onclick={() => removeScheduleUI(si)}
							>
								<TrashBinOutline />
							</Button>
						{/if}
					</div>

					<div class="grid grid-cols-1 gap-3 md:grid-cols-4">
						<div class="md:col-span-2">
							<DateRange bind:startDate={sch.startDate} bind:endDate={sch.endDate} />
						</div>
						<div class="md:col-span-2">
							<div class="mb-1 text-sm"></div>
							<div class="flex flex-wrap gap-3 text-sm">
								{#each DAY_CODES as code}
									<label class="flex items-center gap-2"
										><input
											type="checkbox"
											checked={sch.days.has(code)}
											onchange={() => toggleDaySchedule(sch, code)}
										/>{code}</label
									>
								{/each}
							</div>
						</div>
					</div>

					<div class="mt-3">
						<div class="mb-1 text-sm">Apply to Fields</div>
						<MultiSelect items={fieldSelectItems} bind:value={sch.fieldIds} class="w-full" />
					</div>

					<div class="mt-3 space-y-2">
						{#each sch.windows as w, wi}
							<div class="grid grid-cols-1 gap-2 md:grid-cols-6">
								<div class="md:col-span-3">
									<Timepicker
										type="range"
										bind:value={w.start}
										bind:endValue={w.end}
										onselect={() => onStartInputGlobal(si, wi)}
									/>
								</div>
								<div class="flex items-end">
									{#if sch.windows.length > 1}
										<Button
											type="button"
											size="xs"
											color="red"
											outline
											onclick={() => removeWindowGlobal(si, wi)}
										>
											<TrashBinOutline />
										</Button>
									{/if}
								</div>
							</div>
						{/each}
						<Button type="button" class="btn btn-sm" onclick={() => addWindowGlobal(si)}
							>Add window</Button
						>
					</div>

					{#if validateSchedule(sch)}
						<p class="mt-2 text-sm text-red-700">{validateSchedule(sch)}</p>
					{/if}
				</AccordionItem>
			{/each}
		</Accordion>
		<Button type="button" class="btn btn-secondary btn-sm" onclick={addScheduleUI}
			>Add schedule</Button
		>
		{#each selectedFieldIds as fid}
			<div class="rounded border p-3">
				<div class="mb-2 flex items-center justify-between">
					<h4 class="font-medium">
						{getFieldName(fid)} <span class="text-xs text-gray-500">(UTC)</span>
					</h4>
					<div class="flex items-center gap-2 text-sm text-gray-600">
						<span>Projected: {perFieldEstimates[fid] || 0}</span>
						<Button
							type="button"
							class="btn btn-secondary btn-sm"
							onclick={() => toggleCollapse(fid)}>{collapsed[fid] ? 'Expand' : 'Collapse'}</Button
						>
					</div>
				</div>
				{#if !collapsed[fid]}
					<div class="space-y-4">
						{#each schedulesByField[fid] as sch, si}
							<div class="rounded border p-3">
								<Button
									type="button"
									class="btn btn-secondary btn-sm"
									title="Copy this schedule to other selected fields"
									onclick={() => copyScheduleToOthers(fid, si)}>Copy to others</Button
								>

								<div class="mb-2 flex items-center justify-between">
									<div class="text-sm font-medium">
										{deriveFieldScheduleTitle(sch) || `Schedule ${si + 1}`}
									</div>
									<div class="flex items-center gap-2">
										<Button type="button" size="xs" onclick={() => setPresetDays(sch, 'weekdays')}
											>Weekdays</Button
										>
										<Button type="button" size="xs" onclick={() => setPresetDays(sch, 'weekends')}
											>Weekends</Button
										>
										<Button type="button" size="xs" onclick={() => setPresetDays(sch, 'monfri')}
											>Mon–Fri</Button
										>
										{#if schedulesByField[fid].length > 1}
											<Button
												type="button"
												color="red"
												size="xs"
												onclick={() => removeSchedule(fid, si)}>Remove</Button
											>
										{/if}
									</div>
								</div>
								<div class="grid grid-cols-1 gap-3 md:grid-cols-4">
									<div class="md:col-span-2">
										<DateRange bind:startDate={sch.startDate} bind:endDate={sch.endDate} />
									</div>

									<label class="text-sm">
										<span class="mb-1 block">Start Date</span>
										<input
											class="w-full rounded border px-3 py-2"
											type="date"
											bind:value={sch.startDate}
										/>
									</label>
									<label class="text-sm">
										<span class="mb-1 block">End Date</span>
										<input
											class="w-full rounded border px-3 py-2"
											type="date"
											bind:value={sch.endDate}
										/>
									</label>
									<div class="md:col-span-2">
										<div class="mb-1 text-sm">Days</div>
										<div class="flex flex-wrap gap-3 text-sm">
											{#each DAY_CODES as code}
												<label class="flex items-center gap-2"
													><input
														type="checkbox"
														checked={sch.days.has(code)}
														onchange={() => toggleDay(sch, code)}
													/>
													{code}</label
												>
											{/each}
										</div>
									</div>
								</div>
								<div class="mt-3 space-y-2">
									{#each sch.windows as w, wi}
										<div class="grid grid-cols-1 gap-2 md:grid-cols-6">
											<label class="text-sm md:col-span-4">
												<span class="mb-1 block">Time range (HH:mm)</span>
												<Timepicker
													type="range"
													bind:value={w.start}
													bind:endValue={w.end}
													onselect={() => onStartInput(fid, si, wi)}
												/>
											</label>

											<!--

									{#if false}

											<label class="text-sm md:col-span-2"
												><span class="mb-1 block">Start (HH:mm)</span><input
													class="w-full rounded border px-3 py-2"
													type="time"
													step="60"
													bind:value={w.start}
													oninput={() => onStartInput(fid, si, wi)}
												/></label
											>
											<label class="text-sm md:col-span-2"
												><span class="mb-1 block">End (HH:mm)</span><input
													class="w-full rounded border px-3 py-2"
													type="time"
													step="60"
													bind:value={w.end}
													readonly
									{/if}

												/></label
											>
									-->

											<div class="flex items-end">
												{#if sch.windows.length > 1}<Button
														size="xs"
														color="red"
														onclick={() => removeWindow(fid, si, wi)}>Remove</Button
													>{/if}
											</div>
										</div>
									{/each}
									<Button type="button" size="sm" onclick={() => addWindow(fid, si)}
										>Add window</Button
									>
								</div>
								{#if validateSchedule(schedulesByField[fid][si])}
									<p class="mt-2 text-sm text-red-700">
										{validateSchedule(schedulesByField[fid][si])}
									</p>
								{/if}
							</div>
						{/each}
						<Button type="button" class="btn btn-secondary btn-sm" onclick={() => addSchedule(fid)}
							>Add schedule</Button
						>
					</div>
				{/if}
			</div>
		{/each}

		<div class="flex items-center justify-between">
			<div class="text-sm text-gray-600">
				This preview is an estimate; final validation and overlaps against existing slots are
				enforced server-side.
			</div>
			<Button
				class="btn"
				type="button"
				onclick={openConfirm}
				disabled={!name || aggregateEstimate === 0}>Review and Submit</Button
			>
		</div>
	</div>
</div>
<Modal bind:open={confirmOpen} title="Confirm Draw Session" size="lg">
	<div class="space-y-3 text-sm">
		<div><span class="font-medium">Name:</span> {name || '—'}</div>
		<div><span class="font-medium">Strategy:</span> {turnStrategy}</div>
		<div><span class="font-medium">Projected total slots:</span> {aggregateEstimate}</div>
		<div class="space-y-2">
			{#each data.fields as f}
				{#if (perFieldEstimates[f.id] || 0) > 0}
					<div class="rounded border p-2">
						<div class="flex items-center justify-between">
							<div class="font-medium">{f.name}</div>
							<div>{perFieldEstimates[f.id] || 0}</div>
						</div>
						<div class="mt-1 text-xs text-gray-600">
							{schedules.filter((s) => s.fieldIds.includes(f.id)).length} schedule(s)
						</div>
					</div>
				{/if}
			{/each}
		</div>
		{#if submitError}
			<div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-800">
				{submitError}
			</div>
		{/if}
	</div>
	<div slot="footer">
		<Button
			class="btn btn-secondary"
			type="button"
			onclick={() => (confirmOpen = false)}
			disabled={submitting}>Cancel</Button
		>
		<Button class="btn" type="button" onclick={submitConfirmed} disabled={submitting}
			>Confirm & Create</Button
		>
	</div>
</Modal>
