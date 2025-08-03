<script lang="ts">
	import { onMount } from 'svelte';
	import BallotCard from '$lib/components/BallotCard.svelte';
	import CreateBallotForm from '$lib/components/CreateBallotForm.svelte';
	import type { Ballot, BallotWithVotes } from '$lib/types';

	let ballots: BallotWithVotes[] = [];
	let loading = true;
	let error = '';
	let showCreateForm = false;

	onMount(async () => {
		await loadBallots();
	});

	async function loadBallots() {
		try {
			loading = true;

			const response = await fetch('/api/ballots');

			if (response.ok) {
				const result = await response.json();
				ballots = result.ballots;
			} else {
				error = 'Failed to load ballots';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	function handleBallotCreated(payload: { ballot: Ballot }) {
		ballots = [payload.ballot as unknown as BallotWithVotes, ...ballots];
		showCreateForm = false;
	}

	function toggleCreateForm() {
		showCreateForm = !showCreateForm;
	}
</script>

<div class="container">
	<div class="page-header">
		<h1>Ballots</h1>
		<button on:click={toggleCreateForm} class="btn">
			{showCreateForm ? 'Cancel' : 'Create New Ballot'}
		</button>
	</div>

	{#if showCreateForm}
		<CreateBallotForm onCreated={handleBallotCreated} />
	{/if}

	{#if loading}
		<div class="loading">Loading ballots...</div>
	{:else if error}
		<div class="error">
			{error}
			<button on:click={loadBallots} class="btn btn-sm">Retry</button>
		</div>
	{:else if ballots.length === 0}
		<div class="empty-state">
			<h3>No ballots found</h3>
			<p>Create your first ballot to get started.</p>
			{#if !showCreateForm}
				<button on:click={toggleCreateForm} class="btn"> Create New Ballot </button>
			{/if}
		</div>
	{:else}
		<div class="ballots-list">
			{#each ballots as ballot (ballot.id)}
				<BallotCard {ballot} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.page-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.page-header h1 {
		margin: 0;
		color: #333;
	}

	.loading {
		text-align: center;
		padding: 3rem;
		color: #666;
		font-size: 1.1rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.empty-state h3 {
		color: #666;
		margin-bottom: 1rem;
	}

	.empty-state p {
		color: #888;
		margin-bottom: 2rem;
	}

	.ballots-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: stretch;
		}

		.page-header button {
			width: 100%;
		}
	}
</style>
