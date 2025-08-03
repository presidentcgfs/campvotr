<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '$lib/stores/auth';
	import type { Ballot } from '$lib/types';
	import MarkdownInput from './MarkdownInput.svelte';

	type BallotCreatedPayload = { ballot: Ballot };
	type BallotCreatedHandler = (payload: BallotCreatedPayload) => void;
	let { onCreated } = $props();
	let title = $state('');
	let votingOpensAt = $state('');
	let votingClosesAt = $state('');
	let loading = $state(false);
	let error = $state('');
	let description = $state('');
	// Voter selection
	let voterSelectionType: 'list' | 'individual' = $state('list');
	let selectedVoterListId = $state('');
	let individualVoterEmails = $state('');
	let voterLists: Array<{ id: string; name: string; description: string }> = $state([]);
	let loadingVoterLists = $state(false);

	// Voting threshold
	let votingThreshold: 'simple_majority' | 'supermajority' | 'unanimous' | 'custom' =
		$state('simple_majority');
	let customThresholdPercentage = $state(50);

	// Quorum
	let quorumRequired = $state('');

	// Set default dates (opens now, closes in 24 hours)
	const now = new Date();
	const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

	votingOpensAt = now.toISOString().slice(0, 16);
	votingClosesAt = tomorrow.toISOString().slice(0, 16);

	onMount(async () => {
		await loadVoterLists();
	});

	async function loadVoterLists() {
		try {
			loadingVoterLists = true;
			const response = await fetch('/api/voter-lists', {
				headers: {
					Authorization: `Bearer ${$session?.access_token}`
				}
			});

			if (response.ok) {
				const data = await response.json();
				voterLists = data.voterLists;
			}
		} catch (err) {
			console.error('Failed to load voter lists:', err);
		} finally {
			loadingVoterLists = false;
		}
	}

	async function handleSubmit() {
		if (!title.trim() || !description.trim()) {
			error = 'Please fill in all required fields';
			return;
		}

		if (new Date(votingClosesAt) <= new Date(votingOpensAt)) {
			error = 'Voting close time must be after open time';
			return;
		}

		// Validate voter selection
		if (voterSelectionType === 'list' && !selectedVoterListId) {
			error = 'Please select a voter list';
			return;
		}

		if (voterSelectionType === 'individual' && !individualVoterEmails.trim()) {
			error = 'Please enter at least one voter email';
			return;
		}

		loading = true;
		error = '';

		try {
			const requestBody: any = {
				title: title.trim(),
				description: description.trim(),
				voting_opens_at: new Date(votingOpensAt).toISOString(),
				voting_closes_at: new Date(votingClosesAt).toISOString(),
				voting_threshold: votingThreshold,
				threshold_percentage: votingThreshold === 'custom' ? customThresholdPercentage : undefined,
				quorum_required: quorumRequired ? parseInt(quorumRequired) : undefined
			};

			if (voterSelectionType === 'list') {
				requestBody.voter_list_id = selectedVoterListId;
			} else {
				const emails = individualVoterEmails
					.split('\n')
					.map((email) => email.trim())
					.filter((email) => email.length > 0);
				requestBody.voter_emails = emails;
			}

			const response = await fetch('/api/ballots', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${$session?.access_token}`
				},
				body: JSON.stringify(requestBody)
			});

			if (response.ok) {
				const result = await response.json();
				onCreated?.({ ballot: result.ballot });

				// Reset form
				title = '';
				description = '';
				selectedVoterListId = '';
				individualVoterEmails = '';
				voterSelectionType = 'list';
				votingThreshold = 'simple_majority';
				customThresholdPercentage = 50;
				quorumRequired = '';
				const newNow = new Date();
				const newTomorrow = new Date(newNow.getTime() + 24 * 60 * 60 * 1000);
				votingOpensAt = newNow.toISOString().slice(0, 16);
				votingClosesAt = newTomorrow.toISOString().slice(0, 16);
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to create ballot';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}
</script>

<form on:submit|preventDefault={handleSubmit} class="create-ballot-form">
	<h3>Create New Ballot</h3>

	<div class="form-group">
		<label for="title">Title *</label>
		<input
			id="title"
			type="text"
			bind:value={title}
			placeholder="Enter ballot title"
			required
			maxlength="255"
		/>
	</div>

	<div class="form-group">
		<label for="description">Description (Markdown supported) *</label>

		<MarkdownInput bind:value={description} />
	</div>

	<!-- Voter Selection -->

	<div class="form-group">
		<label for="voter-list">Select Voter List</label>
		{#if loadingVoterLists}
			<p class="loading-text">Loading voter lists...</p>
		{:else if voterLists.length === 0}
			<p class="no-lists">
				No voter lists available.
				<a href="/voter-lists" target="_blank">Create one first</a>
			</p>
		{:else}
			<select id="voter-list" bind:value={selectedVoterListId} required>
				<option value="">Select a voter list...</option>
				{#each voterLists as list}
					<option value={list.id}>{list.name}</option>
				{/each}
			</select>
		{/if}
	</div>

	<div class="form-group">
		<label for="voter-emails"
			>Voter Emails (one per line) {#if !selectedVoterListId}*{/if}</label
		>
		<textarea
			id="voter-emails"
			bind:value={individualVoterEmails}
			placeholder="voter1@example.com&#10;voter2@example.com&#10;voter3@example.com"
			required={!selectedVoterListId}
			rows="6"
		></textarea>
	</div>

	<!-- Voting Threshold -->
	<fieldset class="form-group">
		<legend>Voting Threshold *</legend>
		<div class="radio-group">
			<label class="radio-label">
				<input type="radio" bind:group={votingThreshold} value="simple_majority" />
				<span>Simple Majority (50% + 1)</span>
				<small>Requires more than half of eligible voters to vote "yes"</small>
			</label>
			<label class="radio-label">
				<input type="radio" bind:group={votingThreshold} value="supermajority" />
				<span>Supermajority (2/3)</span>
				<small>Requires at least 66.67% of eligible voters to vote "yes"</small>
			</label>
			<label class="radio-label">
				<input type="radio" bind:group={votingThreshold} value="unanimous" />
				<span>Unanimous (100%)</span>
				<small>Requires all eligible voters to vote "yes"</small>
			</label>
			<label class="radio-label">
				<input type="radio" bind:group={votingThreshold} value="custom" />
				<span>Custom Percentage</span>
				<small>Set a custom percentage threshold</small>
			</label>
		</div>
		{#if votingThreshold === 'custom'}
			<div class="custom-threshold">
				<label for="custom-percentage">Required Percentage *</label>
				<div class="percentage-input">
					<input
						id="custom-percentage"
						type="number"
						bind:value={customThresholdPercentage}
						min="1"
						max="100"
						step="1"
						required
					/>
					<span>%</span>
				</div>
				<small
					>Enter the percentage of eligible voters required to vote "yes" for the ballot to pass</small
				>
			</div>
		{/if}
	</fieldset>

	<!-- Quorum -->
	<div class="form-group">
		<label for="quorum-required">Quorum (Optional)</label>
		<input
			id="quorum-required"
			type="number"
			bind:value={quorumRequired}
			placeholder="e.g., 5"
			min="1"
			step="1"
		/>
		<p class="form-help">
			Minimum number of voters required to participate for this vote to be valid. Leave blank if no
			quorum is required.
		</p>
	</div>

	<div class="form-row">
		<div class="form-group">
			<label for="voting-opens">Voting Opens *</label>
			<input id="voting-opens" type="datetime-local" bind:value={votingOpensAt} required />
		</div>

		<div class="form-group">
			<label for="voting-closes">Voting Closes *</label>
			<input id="voting-closes" type="datetime-local" bind:value={votingClosesAt} required />
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="form-actions">
		<button type="submit" disabled={loading} class="btn">
			{loading ? 'Creating...' : 'Create Ballot'}
		</button>
	</div>
</form>

<style>
	.create-ballot-form {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.create-ballot-form h3 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #333;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #555;
	}

	.form-help {
		font-size: 0.75rem;
		color: #666;
		margin-top: 0.25rem;
		margin-bottom: 0;
	}

	input,
	textarea,
	select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
		font-family: inherit;
	}

	input:focus,
	textarea:focus,
	select:focus {
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
	}

	textarea {
		resize: vertical;
		min-height: 100px;
	}

	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.radio-label {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		font-weight: normal;
		margin-bottom: 0;
		cursor: pointer;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.radio-label:hover {
		background-color: #f8f9fa;
	}

	.radio-label input[type='radio'] {
		width: auto;
		margin: 0;
		margin-top: 0.125rem;
	}

	.radio-label span {
		font-weight: 500;
		color: #333;
	}

	.radio-label small {
		color: #666;
		font-size: 0.875rem;
		display: block;
		margin-top: 0.25rem;
	}

	.custom-threshold {
		margin-top: 1rem;
		padding: 1rem;
		background-color: #f8f9fa;
		border-radius: 4px;
		border: 1px solid #e9ecef;
	}

	.percentage-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.percentage-input input {
		width: 100px;
	}

	.percentage-input span {
		font-weight: 500;
		color: #333;
	}

	.loading-text {
		color: #666;
		font-style: italic;
		margin: 0;
	}

	.no-lists {
		color: #666;
		margin: 0;
	}

	.no-lists a {
		color: #007bff;
		text-decoration: none;
	}

	.no-lists a:hover {
		text-decoration: underline;
	}

	.form-actions {
		margin-top: 1.5rem;
	}

	.error {
		color: #dc3545;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		padding: 0.75rem;
		margin-bottom: 1rem;
	}

	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}

		.create-ballot-form {
			padding: 1rem;
		}
	}
</style>
