<script lang="ts">
	import type { PageData } from '../../../routes/admin/draw-sessions/$types';
	export let data: PageData;

	// Create form state
	let name = '';
	let turnStrategy: 'fixed' | 'randomized' | 'snake' = 'fixed';
	let rounds: number | '' = '';
	let pickTimeoutSec = 60;
	let startsAtUtc = '';
	let participants = '';

	// Date range and per-field windows (UTC)
	let startDate = '';
	let endDate = '';
	type TimeWindow = { start: string; end: string; endLocked?: boolean };
	type FieldWinBlock = { fieldId: string; windows: TimeWindow[] };
	let fieldWinBlocks: FieldWinBlock[] = [];
	const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
	let selectedDays = new Set<string>(['MO', 'TU', 'WE', 'TH', 'FR']);
	let selectedFieldIds: string[] = [];

	function addMinutes(hhmm: string, minutes: number): string {
		const [h, m] = hhmm.split(':').map((n) => Number(n || 0));
		let total = h * 60 + m + minutes;
		if (total >= 24 * 60) total = 23 * 60 + 59; // no over-midnight; clamp for UI
		const hh = String(Math.floor(total / 60)).padStart(2, '0');
		const mm = String(total % 60).padStart(2, '0');
		return `${hh}:${mm}`;
	}
	function toggleField(fid: string) {
		if (selectedFieldIds.includes(fid)) {
			selectedFieldIds = selectedFieldIds.filter((x) => x !== fid);
			fieldWinBlocks = fieldWinBlocks.filter((b) => b.fieldId !== fid);
		} else {
			selectedFieldIds = [...selectedFieldIds, fid];
			if (!fieldWinBlocks.find((b) => b.fieldId === fid))
				fieldWinBlocks = [
					...fieldWinBlocks,
					{ fieldId: fid, windows: [{ start: '', end: '', endLocked: false }] }
				];
		}
	}
	function onStartFieldInput(fi: number, wi: number) {
		const b = fieldWinBlocks[fi];
		if (!b) return;
		const w = b.windows[wi];
		if (w && !w.endLocked && w.start) b.windows[wi] = { ...w, end: addMinutes(w.start, 60) };
		fieldWinBlocks = [...fieldWinBlocks];
	}
	function onEndFieldInput(fi: number, wi: number) {
		const b = fieldWinBlocks[fi];
		if (!b) return;
		const w = b.windows[wi];
		if (!w) return;
		b.windows[wi] = { ...w, endLocked: true };
		fieldWinBlocks = [...fieldWinBlocks];
	}
	function addWindowFor(fi: number) {
		const b = fieldWinBlocks[fi];
		if (!b) return;
		b.windows = [...b.windows, { start: '', end: '', endLocked: false }];
		fieldWinBlocks = [...fieldWinBlocks];
	}
	function removeWindowFor(fi: number, wi: number) {
		const b = fieldWinBlocks[fi];
		if (!b) return;
		b.windows = b.windows.filter((_, idx) => idx !== wi);
		if (b.windows.length === 0) b.windows = [{ start: '', end: '', endLocked: false }];
		fieldWinBlocks = [...fieldWinBlocks];
	}
	function getFieldName(fid: string): string {
		const f = (data.fields || []).find((x: any) => x.id === fid);
		return f?.name || fid;
	}
	function setPreset(p: 'weekdays' | 'weekends' | 'monfri' | 'custom') {
		if (p === 'weekdays' || p === 'monfri') selectedDays = new Set(['MO', 'TU', 'WE', 'TH', 'FR']);
		else if (p === 'weekends') selectedDays = new Set(['SA', 'SU']);
	}
	function toggleDay(code: string) {
		if (selectedDays.has(code)) selectedDays.delete(code);
		else selectedDays.add(code);
		selectedDays = new Set(selectedDays);
	}
	// Estimated total slots
	function countMatchingDates(): number {
		if (!startDate || !endDate) return 0;
		const s = new Date(`${startDate}T00:00:00Z`);
		const e = new Date(`${endDate}T00:00:00Z`);
		if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
		let c = 0;
		for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
			const code = DAY_CODES[d.getUTCDay()];
			if (selectedDays.has(code)) c++;
		}
		return c;
	}
	$: estimatedSlots =
		countMatchingDates() * fieldWinBlocks.reduce((n, b) => n + (b.windows?.length || 0), 0);
	$: fieldWindowsJson = JSON.stringify(
		fieldWinBlocks.map((b) => ({
			fieldId: b.fieldId,
			windows: b.windows.map((w) => ({ startTime: w.start, endTime: w.end }))
		}))
	);

	function resetForm() {
		name = '';
		turnStrategy = 'fixed';
		rounds = '' as any;
		pickTimeoutSec = 60;
		startsAtUtc = '';
		participants = '';
		startDate = '';
		endDate = '';
		fieldWinBlocks = [];
		selectedDays = new Set(['MO', 'TU', 'WE', 'TH', 'FR']);
		selectedFieldIds = [];
	}
</script>

<div class="container space-y-6">
	<div class="card">
		<h2 class="mb-4 text-xl font-semibold">Create Draw Session</h2>
		<form method="post" action="?/create" class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<label class="mb-1 block text-sm font-medium" for="name">Name</label>
				<input
					id="name"
					name="name"
					bind:value={name}
					class="w-full rounded border px-3 py-2"
					required
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium" for="turnStrategy">Turn Strategy</label>
				<select
					id="turnStrategy"
					name="turnStrategy"
					bind:value={turnStrategy}
					class="w-full rounded border px-3 py-2"
				>
					<option value="fixed">Fixed</option>
					<option value="randomized">Randomized</option>
					<option value="snake">Snake</option>
				</select>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium" for="rounds">Rounds (optional)</label>
				<input
					id="rounds"
					name="rounds"
					type="number"
					min="1"
					bind:value={rounds}
					class="w-full rounded border px-3 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium" for="pickTimeoutSec">Pick Timeout (sec)</label
				>
				<input
					id="pickTimeoutSec"
					name="pickTimeoutSec"
					type="number"
					min="5"
					bind:value={pickTimeoutSec}
					class="w-full rounded border px-3 py-2"
				/>
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium" for="startsAtUtc">Starts At (UTC)</label>
				<input
					id="startsAtUtc"
					name="startsAtUtc"
					type="datetime-local"
					bind:value={startsAtUtc}
					class="w-full rounded border px-3 py-2"
				/>
			</div>

			<div class="md:col-span-2">
				<label class="mb-1 block text-sm font-medium" for="participants"
					>Participants (one email per line, e.g. alice@example.com or alice@example.com:captain)</label
				>
				<textarea
					id="participants"
					name="participants"
					bind:value={participants}
					class="w-full rounded border px-3 py-2"
					rows="4"
					placeholder="alice@example.com\nbob@example.com:captain"
				></textarea>
				<p class="mt-1 text-xs text-gray-600">
					We resolve emails to members of this organization. Unknown emails will be rejected.
				</p>
			</div>

			<!-- Schedule (UTC): Date range, time-of-day, days, and Fields -->
			<div class="space-y-4 md:col-span-2">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<label class="text-sm">
						<span class="mb-1 block">Start Date (UTC)</span>
						<input
							name="startDate"
							type="date"
							bind:value={startDate}
							class="w-full rounded border px-3 py-2"
						/>
					</label>
					<label class="text-sm">
						<span class="mb-1 block">End Date (UTC)</span>
						<input
							name="endDate"
							type="date"
							bind:value={endDate}
							class="w-full rounded border px-3 py-2"
						/>
					</label>
				</div>

				<div class="space-y-2">
					<div class="flex flex-wrap items-center gap-2 text-sm">
						<span class="font-medium">Days:</span>
						<button
							type="button"
							class="btn btn-secondary btn-sm"
							on:click={() => setPreset('weekdays')}>Weekdays</button
						>
						<button
							type="button"
							class="btn btn-secondary btn-sm"
							on:click={() => setPreset('weekends')}>Weekends</button
						>
						<button
							type="button"
							class="btn btn-secondary btn-sm"
							on:click={() => setPreset('monfri')}>Mon–Fri</button
						>
					</div>
					<div class="flex flex-wrap gap-3">
						{#each DAY_CODES as code}
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={selectedDays.has(code)}
									on:change={() => toggleDay(code)}
								/>
								<span>{code}</span>
							</label>
						{/each}
					</div>
				</div>

				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-semibold">Fields</h3>
						<span class="text-sm text-gray-600">Estimated slots: {estimatedSlots}</span>
					</div>
					<div class="grid grid-cols-1 gap-2 md:grid-cols-3">
						{#each data.fields as f}
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={selectedFieldIds.includes(f.id)}
									on:change={() => toggleField(f.id)}
								/>
								<span>{f.name}</span>
							</label>
						{/each}
					</div>
				</div>

				<!-- Per-field time windows (UTC) -->
				{#each fieldWinBlocks as b, fi}
					<div class="rounded border p-3">
						<div class="mb-2 flex items-center justify-between">
							<h4 class="font-medium">
								{getFieldName(b.fieldId)} <span class="text-xs text-gray-500">(UTC)</span>
							</h4>
							<button
								type="button"
								class="btn btn-danger btn-sm"
								on:click={() => toggleField(b.fieldId)}>Remove Field</button
							>
						</div>
						<div class="space-y-2">
							{#each b.windows as w, wi}
								<div class="grid grid-cols-1 gap-2 md:grid-cols-4">
									<label class="text-sm">
										<span class="mb-1 block">Start (HH:mm)</span>
										<input
											type="time"
											step="60"
											bind:value={w.start}
											on:input={() => onStartFieldInput(fi, wi)}
											class="w-full rounded border px-3 py-2"
										/>
									</label>
									<label class="text-sm">
										<span class="mb-1 block">End (HH:mm)</span>
										<input
											type="time"
											step="60"
											bind:value={w.end}
											on:input={() => onEndFieldInput(fi, wi)}
											class="w-full rounded border px-3 py-2"
										/>
									</label>

									<div class="flex items-end">
										{#if b.windows.length > 1}
											<button
												type="button"
												class="btn btn-danger btn-sm"
												on:click={() => removeWindowFor(fi, wi)}>Remove</button
											>
										{/if}
									</div>
								</div>
							{/each}
							<div>
								<button type="button" class="btn btn-sm" on:click={() => addWindowFor(fi)}
									>Add window</button
								>
							</div>
						</div>
					</div>
				{/each}

				<input type="hidden" name="fieldWindows" value={fieldWindowsJson} />

				<input type="hidden" name="days" value={[...selectedDays].join(',')} />
				<input type="hidden" name="fieldIds" value={selectedFieldIds.join(',')} />
			</div>

			<div class="flex gap-2 md:col-span-2">
				<button type="submit" class="btn">Create Session</button>
				<button type="button" class="btn btn-secondary" on:click={resetForm}>Reset</button>
			</div>
		</form>
	</div>

	<div class="card">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Sessions</h2>
			<span class="text-sm text-gray-500">{data.sessions?.length ?? 0} total</span>
		</div>

		{#if data.sessions && data.sessions.length}
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b text-left">
							<th class="py-2 pr-4">Name</th>
							<th class="py-2 pr-4">Status</th>
							<th class="py-2 pr-4">Strategy</th>
							<th class="py-2 pr-4">Rounds</th>
							<th class="py-2 pr-4">Timeout</th>
							<th class="py-2 pr-4">Starts</th>
							<th class="py-2 pr-4">Created</th>
							<th class="py-2 pr-4">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.sessions as s}
							<tr class="border-b">
								<td class="py-2 pr-4 font-medium">{s.name}</td>
								<td class="py-2 pr-4">{s.status}</td>
								<td class="py-2 pr-4">{s.turnStrategy}</td>
								<td class="py-2 pr-4">{s.rounds ?? '—'}</td>
								<td class="py-2 pr-4">{s.pickTimeoutSec}s</td>
								<td class="py-2 pr-4"
									>{s.startsAtUtc ? new Date(s.startsAtUtc).toUTCString() : '—'}</td
								>
								<td class="py-2 pr-4">{new Date(s.createdAt).toUTCString?.() ?? ''}</td>
								<td class="py-2 pr-4">
									<div class="flex gap-2">
										{#if s.status === 'scheduled'}
											<form method="post" action="?/start" class="inline">
												<input type="hidden" name="id" value={s.id} />
												<button class="btn btn-sm">Start</button>
											</form>
											<form method="get" action={`/draw/${s.id}`} class="inline">
												<button class="btn btn-secondary btn-sm">Open</button>
											</form>
										{:else if s.status === 'active'}
											<form method="post" action="?/pause" class="inline">
												<input type="hidden" name="id" value={s.id} />
												<button class="btn btn-secondary btn-sm">Pause</button>
											</form>
											<form method="post" action="?/complete" class="inline">
												<input type="hidden" name="id" value={s.id} />
												<button class="btn btn-success btn-sm">Complete</button>
											</form>
											<form method="post" action="?/cancel" class="inline">
												<input type="hidden" name="id" value={s.id} />
												<button class="btn btn-danger btn-sm">Cancel</button>
											</form>
											<form method="get" action={`/draw/${s.id}`} class="inline">
												<button class="btn btn-secondary btn-sm">Open</button>
											</form>
										{:else if s.status === 'paused'}
											<form method="post" action="?/resume" class="inline">
												<input type="hidden" name="id" value={s.id} />
												<button class="btn btn-sm">Resume</button>
											</form>
											<form method="post" action="?/cancel" class="inline">
												<input type="hidden" name="id" value={s.id} />
												<button class="btn btn-danger btn-sm">Cancel</button>
											</form>
											<form method="get" action={`/draw/${s.id}`} class="inline">
												<button class="btn btn-secondary btn-sm">Open</button>
											</form>
										{:else}
											<form method="get" action={`/draw/${s.id}`} class="inline">
												<button class="btn btn-secondary btn-sm">Open</button>
											</form>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-gray-600">No sessions yet.</p>
		{/if}
	</div>
</div>
