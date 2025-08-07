<script lang="ts">
	import { onMount } from 'svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import MarkdownInput from '$lib/components/MarkdownInput.svelte';

	interface VoterList {
		id: string;
		name: string;
		description: string;
		created_at: string;
		updated_at: string;
		voterCount: number;
	}

	interface Voter {
		id: string;
		email: string;
		name: string | null;
		user_id: string | null;
		added_at: string;
	}
	let voterLists: VoterList[] = [];
	$: voterLists = [];
	$: loading = true;
	$: error = '';
	let showCreateForm = false;
	let selectedList: VoterList | null = null;
	let selectedListVoters: Voter[] = [];
	$: {
		console.log({ selectedList });
	}
	// Form data
	let newListName = '';
	let newListDescription = '';
	let newListVoterEmails = '';

	function openCreateListModal() {
		showCreateForm = true;
	}
	function closeCreateListModal() {
		showCreateForm = false;
	}
	onMount(async () => {
		await fetchVoterLists();
	});

	async function fetchVoterLists() {
		try {
			loading = true;
			const response = await fetch('/api/voter-lists');

			if (!response.ok) {
				throw new Error('Failed to fetch voter lists');
			}

			const data = await response.json();
			voterLists = data.voterLists;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function createVoterList() {
		try {
			const voterEmails = newListVoterEmails;

			const response = await fetch('/api/voter-lists', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: newListName,
					description: newListDescription || undefined,
					voterEmails
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create voter list');
			}

			// Reset form
			newListName = '';
			newListDescription = '';
			newListVoterEmails = '';
			showCreateForm = false;

			// Refresh lists
			await fetchVoterLists();
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		}
	}

	async function viewVoterList(list: VoterList) {
		try {
			selectedList = list;
			const response = await fetch(`/api/voter-lists/${list.id}`);

			if (!response.ok) {
				throw new Error('Failed to fetch voter list details');
			}

			const data = await response.json();
			selectedListVoters = data.voterList.voters;
			console.log({ selectedListVoters });
		} catch (err) {
			console.error(err);
			error = err instanceof Error ? err.message : 'An error occurred';
		}
	}

	async function deleteVoterList(listId: string) {
		if (!confirm('Are you sure you want to delete this voter list?')) {
			return;
		}

		try {
			const response = await fetch(`/api/voter-lists/${listId}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				throw new Error('Failed to delete voter list');
			}

			await fetchVoterLists();
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		}
	}

	function closeModal() {
		selectedList = null;
		selectedListVoters = [];
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString();
	}

	function getVoterStatus(voter: Voter) {
		return voter.user_id ? 'Registered' : 'Email Only';
	}
</script>

<svelte:head>
	<title>Voter Lists - CampVotr</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8 flex items-center justify-between p-2">
		<h1 class="text-3xl font-bold text-gray-900">Voter Lists</h1>
		<button
			on:click={openCreateListModal}
			class="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
		>
			Create New List
		</button>
	</div>

	{#if error}
		<div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="py-8 text-center">
			<div class="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
			<p class="mt-4 text-gray-600">Loading voter lists...</p>
		</div>
	{:else if voterLists.length === 0}
		<div class="py-12 text-center">
			<p class="text-lg text-gray-600">No voter lists created yet.</p>
			<button
				on:click={openCreateListModal}
				class="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
			>
				Create Your First List
			</button>
		</div>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each voterLists as list}
				<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-md">
					<h3 class="mb-2 text-xl font-semibold text-gray-900">{list.name}</h3>
					{#if list.description}
						<div class="mb-4 text-gray-600">
							<Markdown content={list.description} />
						</div>
					{/if}
					<div class="mb-4 text-sm text-gray-500">
						<p>{list.voterCount} voters</p>
						<p>Created {formatDate(list.created_at)}</p>
					</div>
					<div class="flex gap-2">
						<button
							on:click={() => viewVoterList(list)}
							class="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
						>
							View Details
						</button>
						<button
							on:click={() => deleteVoterList(list.id)}
							class="rounded bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Voter List Modal (reusable component) -->
<Modal
	bind:open={showCreateForm}
	title="Create New Voter List"
	size="md"
	initialFocus="input[name='listName']"
>
	<form on:submit|preventDefault={createVoterList}>
		<div class="mb-4">
			<label for="create-list-name" class="mb-2 block text-sm font-medium text-gray-700">
				List Name *
			</label>
			<input
				id="create-list-name"
				name="listName"
				type="text"
				bind:value={newListName}
				required
				class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="Enter list name"
				data-autofocus
			/>
		</div>

		<div class="mb-4">
			<label for="description" class="mb-2 block text-sm font-medium text-gray-700">
				Description (Markdown supported)
			</label>
			<MarkdownInput bind:value={newListDescription} />
		</div>

		<div class="mb-6">
			<label for="voters" class="mb-2 block text-sm font-medium text-gray-700">
				Voter Emails (one per line)
			</label>
			<textarea
				id="voters"
				bind:value={newListVoterEmails}
				rows="6"
				class="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="voter1@example.com&#10;voter2@example.com&#10;voter3@example.com"
			></textarea>
		</div>
	</form>

	<div slot="footer" class="flex justify-end gap-3">
		<button
			type="button"
			class="flex-1 rounded-md bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400"
			on:click={closeCreateListModal}
		>
			Cancel
		</button>
		<button
			type="button"
			class="flex-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
			on:click={createVoterList}
		>
			Create List
		</button>
	</div>
</Modal>

<!-- Voter List Details Modal (reusable component) -->
<Modal
	open={!!selectedList}
	role="dialog"
	size="lg"
	ariaLabel={selectedList ? `${selectedList.name} details` : 'Voter list details'}
	closeOnOutsideClick={true}
>
	{#if selectedList}
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-2xl font-bold text-gray-900">{selectedList.name}</h2>
		</div>

		{#if selectedList.description}
			<div class="mb-4 text-gray-600">
				<Markdown content={selectedList.description} />
			</div>
		{/if}

		<div class="mb-4">
			<h3 class="mb-2 text-lg font-semibold text-gray-900">
				Voters ({selectedListVoters.length})
			</h3>

			{#if selectedListVoters.length === 0}
				<p class="text-gray-500">No voters in this list yet.</p>
			{:else}
				<div class="space-y-2">
					{#each selectedListVoters as voter}
						<div class="flex items-center justify-between rounded-lg bg-gray-50 p-3">
							<div>
								<p class="font-medium text-gray-900">{voter.email}</p>
								{#if voter.name}
									<p class="text-sm text-gray-600">{voter.name}</p>
								{/if}
							</div>
							<div class="text-right">
								<span
									class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {voter.user_id
										? 'bg-green-100 text-green-800'
										: 'bg-yellow-100 text-yellow-800'}"
								>
									{getVoterStatus(voter)}
								</span>
								<p class="mt-1 text-xs text-gray-500">Added {formatDate(voter.added_at)}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	<div slot="footer" class="flex justify-end">
		<button
			on:click={closeModal}
			class="rounded-md bg-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-400"
		>
			Close
		</button>
	</div>
</Modal>
