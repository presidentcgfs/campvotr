<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	$: session = data.session;
	$: participants = data.participants;
	$: picks = data.picks;
	$: available = data.available;
	$: fields = (data as any).fields || [];
	$: current = data.current;
	$: isMyTurn = data.isMyTurn;

	let selectedFieldId: string | '' = '';
	let groupByField = true;
	let filtered: any[] = [];
	let slotsByField: Record<string, any[]> = {};

	$: filtered = selectedFieldId
		? available.filter((s: any) => s.fieldId === selectedFieldId)
		: available;
	$: slotsByField = filtered.reduce((acc: Record<string, any[]>, s: any) => {
		const key = s.fieldId;
		(acc[key] ||= []).push(s);
		return acc;
	}, {});

	$: nameByParticipantId = Object.fromEntries(
		(participants as any[]).map((p: any) => [p.id, p.displayName || p.userId])
	);
</script>

<div class="container space-y-6">
	<div class="card">
		<div class="mb-4 flex items-center justify-between">
			<h1 class="text-2xl font-bold">{session?.name ?? 'Draw Session'}</h1>
			<div class="text-sm text-gray-600">Status: {session?.status}</div>
		</div>

		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			<div>
				<h2 class="mb-2 text-lg font-semibold">Participants</h2>
				<ul class="space-y-1">
					{#each participants as p}
						<li
							class="flex items-center justify-between rounded border px-2 py-1 text-sm {current?.participantId ===
							p.id
								? 'bg-blue-50 font-semibold'
								: ''}"
						>
							<span>{p.displayName ?? p.userId}</span>
							{#if current?.participantId === p.id}
								<span class="text-xs text-blue-600">Current</span>
							{/if}
						</li>
					{/each}
				</ul>
			</div>

			<div class="md:col-span-2">
				<h2 class="mb-2 text-lg font-semibold">Picks</h2>
				{#if picks && picks.length}
					<div class="overflow-x-auto">
						<table class="min-w-full text-sm">
							<thead>
								<tr class="border-b text-left">
									<th class="py-2 pr-4">Participant</th>
									<th class="py-2 pr-4">Round#</th>
									<th class="py-2 pr-4">Turn#</th>
									<th class="py-2 pr-4">Picked At</th>
								</tr>
							</thead>
							<tbody>
								{#each picks as v}
									<tr class="border-b">
										<td class="py-2 pr-4"
											>{nameByParticipantId[v.participantId] ?? v.participantId}</td
										>
										<td class="py-2 pr-4">{v.roundNumber}</td>
										<td class="py-2 pr-4">{v.turnNumber}</td>
										<td class="py-2 pr-4">{new Date(v.pickedAtUtc).toUTCString?.() ?? ''}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="text-gray-600">No picks yet.</p>
				{/if}
			</div>
		</div>
	</div>

	<div class="card">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Available Slots</h2>
			<div class="text-sm {isMyTurn ? 'text-green-700' : 'text-gray-600'}">
				{isMyTurn ? "It's your turn" : 'Waiting for your turn'}
			</div>
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-3">
			<label class="text-sm">
				<span class="mr-2">Filter Field:</span>
				<select bind:value={selectedFieldId} class="rounded border px-2 py-1">
					<option value="">All Fields</option>
					{#each fields as f}
						<option value={f.id}>{f.name}</option>
					{/each}
				</select>
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={groupByField} />
				<span>Group by Field</span>
			</label>
		</div>

		{#if filtered && filtered.length}
			{#if groupByField}
				<div class="space-y-6">
					{#each Object.keys(slotsByField) as fid}
						<div>
							<h3 class="mb-2 text-lg font-semibold">
								{filtered.find((s: any) => s.fieldId === fid)?.fieldName || fid}
							</h3>
							<div class="overflow-x-auto">
								<table class="min-w-full text-sm">
									<thead>
										<tr class="border-b text-left">
											<th class="py-2 pr-4">Start (UTC)</th>
											<th class="py-2 pr-4">End (UTC)</th>
											<th class="py-2 pr-4">Pick</th>
										</tr>
									</thead>
									<tbody>
										{#each slotsByField[fid] as s}
											<tr class="border-b">
												<td class="py-2 pr-4">{new Date(s.startUtc).toUTCString()}</td>
												<td class="py-2 pr-4">{new Date(s.endUtc).toUTCString()}</td>
												<td class="py-2 pr-4">
													<form method="post" action="?/pick" class="inline">
														<input type="hidden" name="timeSlotId" value={s.id} />
														<button class="btn btn-sm" disabled={!isMyTurn}>Pick</button>
													</form>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full text-sm">
						<thead>
							<tr class="border-b text-left">
								<th class="py-2 pr-4">Field</th>
								<th class="py-2 pr-4">Start (UTC)</th>
								<th class="py-2 pr-4">End (UTC)</th>
								<th class="py-2 pr-4">Pick</th>
							</tr>
						</thead>
						<tbody>
							{#each filtered as s}
								<tr class="border-b">
									<td class="py-2 pr-4">{s.fieldName || s.fieldId}</td>
									<td class="py-2 pr-4">{new Date(s.startUtc).toUTCString()}</td>
									<td class="py-2 pr-4">{new Date(s.endUtc).toUTCString()}</td>
									<td class="py-2 pr-4">
										<form method="post" action="?/pick" class="inline">
											<input type="hidden" name="timeSlotId" value={s.id} />
											<button class="btn btn-sm" disabled={!isMyTurn}>Pick</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{:else}
			<p class="text-gray-600">No available slots (next 30 days).</p>
		{/if}
	</div>
</div>
