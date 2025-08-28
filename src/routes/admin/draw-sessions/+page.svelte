<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/stores';
	import FieldSchedulesForm from '$lib/components/field-draw/FieldSchedulesForm.svelte';
	export let data: PageData;
</script>

<div class="container space-y-6">
	<h1 class="text-2xl font-bold">Draw Sessions</h1>
	{#if $page.form?.error}
		<div class="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
			{$page.form.error}
		</div>
	{/if}

	<FieldSchedulesForm {data} />

	<div class="card">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Existing Sessions</h2>
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
