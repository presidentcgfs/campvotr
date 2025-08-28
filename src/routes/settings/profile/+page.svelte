<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;
	let displayName = data.displayName || '';
</script>

<div class="container max-w-xl">
	<h1 class="mb-4 text-2xl font-bold">Profile</h1>

	<div class="card">
		<form method="post" action="?/update" class="space-y-4">
			<div>
				<label for="displayName" class="mb-1 block text-sm font-medium">Display Name</label>
				<input
					id="displayName"
					name="displayName"
					bind:value={displayName}
					class="w-full rounded border px-3 py-2"
					maxlength="64"
				/>
				<p class="mt-1 text-xs text-gray-600">
					1–64 characters; used in Draw participants and picks.
				</p>
			</div>

			<div class="flex gap-2">
				<button type="submit" class="btn">Save</button>
			</div>
		</form>
	</div>
</div>
