<script lang="ts">
	import type { PageData } from '../../../routes/admin/fields/$types';
	export let data: PageData;
	let name = '';
	let location = '';
	let notes = '';
	let capacity: number = 1;
	let active: boolean = true;

	function resetForm() {
		name = '';
		location = '';
		notes = '';
		capacity = 1;
		active = true;
	}
</script>

<div class="container space-y-6">
	<div class="card">
		<h2 class="mb-4 text-xl font-semibold">Create Field</h2>
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
				<label class="mb-1 block text-sm font-medium" for="location">Location</label>
				<input
					id="location"
					name="location"
					bind:value={location}
					class="w-full rounded border px-3 py-2"
				/>
			</div>
			<div class="md:col-span-2">
				<label class="mb-1 block text-sm font-medium" for="notes">Notes</label>
				<textarea
					id="notes"
					name="notes"
					bind:value={notes}
					class="w-full rounded border px-3 py-2"
					rows="3"
				></textarea>
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium" for="capacity">Capacity</label>
				<input
					id="capacity"
					name="capacity"
					type="number"
					min="1"
					bind:value={capacity}
					class="w-full rounded border px-3 py-2"
				/>
			</div>
			<div class="flex items-center gap-2">
				<input id="active" name="active" type="checkbox" bind:checked={active} class="h-4 w-4" />
				<label for="active" class="text-sm">Active</label>
			</div>
			<div class="flex gap-2 md:col-span-2">
				<button type="submit" class="btn">Save</button>
				<button type="button" class="btn btn-secondary" on:click={resetForm}>Reset</button>
			</div>
		</form>
	</div>

	<div class="card">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-xl font-semibold">Fields</h2>
			<span class="text-sm text-gray-500">{data.fields?.length ?? 0} total</span>
		</div>
		{#if data.fields && data.fields.length}
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b text-left">
							<th class="py-2 pr-4">Name</th>
							<th class="py-2 pr-4">Location</th>
							<th class="py-2 pr-4">Capacity</th>
							<th class="py-2 pr-4">Active</th>
							<th class="py-2 pr-4">Created</th>
							<th class="py-2 pr-4">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.fields as f}
							<tr class="border-b">
								<td class="py-2 pr-4 font-medium">{f.name}</td>
								<td class="py-2 pr-4">{f.location}</td>
								<td class="py-2 pr-4">{f.capacity}</td>
								<td class="py-2 pr-4">
									{#if f.active === 1}<span
											class="rounded bg-green-100 px-2 py-1 text-xs text-green-700">Active</span
										>{:else}<span class="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
											>Inactive</span
										>{/if}
								</td>
								<td class="py-2 pr-4">{new Date(f.createdAt).toLocaleString?.() ?? ''}</td>
								<td class="py-2 pr-4">
									<form method="post" action="?/delete" class="inline">
										<input type="hidden" name="id" value={f.id} />
										<button class="btn btn-danger btn-sm" aria-label="Delete {f.name}"
											>Delete</button
										>
									</form>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-gray-600">No fields yet.</p>
		{/if}
	</div>
</div>

<style>
	/* Keep styles minimal; prefer Tailwind utility classes */
</style>
