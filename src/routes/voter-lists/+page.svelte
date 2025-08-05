<script lang="ts">
	import { onMount } from 'svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import Modal from '../../components/Modal.svelte';
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
	<div class="flex justify-between items-center mb-8 p-2">
		<h1 class="text-3xl font-bold text-gray-900">Voter Lists</h1>
		<button
			on:click={openCreateListModal}
			class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
		>
			Create New List
		</button>
	</div>

	{#if error}
		<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="text-center py-8">
			<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
			<p class="mt-4 text-gray-600">Loading voter lists...</p>
		</div>
	{:else if voterLists.length === 0}
		<div class="text-center py-12">
			<p class="text-gray-600 text-lg">No voter lists created yet.</p>
			<button
				on:click={openCreateListModal}
				class="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
			>
				Create Your First List
			</button>
		</div>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each voterLists as list}
				<div class="bg-white rounded-lg shadow-md p-4 border border-gray-200">
					<h3 class="text-xl font-semibold text-gray-900 mb-2">{list.name}</h3>
					{#if list.description}
						<div class="text-gray-600 mb-4">
							<Markdown content={list.description} />
						</div>
					{/if}
					<div class="text-sm text-gray-500 mb-4">
						<p>{list.voterCount} voters</p>
						<p>Created {formatDate(list.created_at)}</p>
					</div>
					<div class="flex gap-2">
						<button
							on:click={() => viewVoterList(list)}
							class="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
						>
							View Details
						</button>
						<button
							on:click={() => deleteVoterList(list.id)}
							class="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 transition-colors text-sm"
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
			<label for="create-list-name" class="block text-sm font-medium text-gray-700 mb-2">
				List Name *
			</label>
			<input
				id="create-list-name"
				name="listName"
				type="text"
				bind:value={newListName}
				required
				class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="Enter list name"
				data-autofocus
			/>
		</div>

		<div class="mb-4">
			<label for="description" class="block text-sm font-medium text-gray-700 mb-2">
				Description (Markdown supported)
			</label>
			<MarkdownInput bind:value={newListDescription} />
		</div>

		<div class="mb-6">
			<label for="voters" class="block text-sm font-medium text-gray-700 mb-2">
				Voter Emails (one per line)
			</label>
			<textarea
				id="voters"
				bind:value={newListVoterEmails}
				rows="6"
				class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="voter1@example.com&#10;voter2@example.com&#10;voter3@example.com"
			></textarea>
		</div>
	</form>

	<div slot="footer" class="flex gap-3 justify-end">
		<button
			type="button"
			class="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
			on:click={closeCreateListModal}
		>
			Cancel
		</button>
		<button
			type="button"
			class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
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
		<div class="flex justify-between items-center mb-4">
			<h2 class="text-2xl font-bold text-gray-900">{selectedList.name}</h2>
		</div>

		{#if selectedList.description}
			<div class="text-gray-600 mb-4">
				<Markdown content={selectedList.description} />
			</div>
		{/if}

		<div class="mb-4">
			<h3 class="text-lg font-semibold text-gray-900 mb-2">
				Voters ({selectedListVoters.length})
			</h3>

			{#if selectedListVoters.length === 0}
				<p class="text-gray-500">No voters in this list yet.</p>
			{:else}
				<div class="space-y-2">
					{#each selectedListVoters as voter}
						<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
							<div>
								<p class="font-medium text-gray-900">{voter.email}</p>
								{#if voter.name}
									<p class="text-sm text-gray-600">{voter.name}</p>
								{/if}
							</div>
							<div class="text-right">
								<span
									class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {voter.user_id
										? 'bg-green-100 text-green-800'
										: 'bg-yellow-100 text-yellow-800'}"
								>
									{getVoterStatus(voter)}
								</span>
								<p class="text-xs text-gray-500 mt-1">Added {formatDate(voter.added_at)}</p>
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
			class="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
		>
			Close
		</button>
	</div>
</Modal>
