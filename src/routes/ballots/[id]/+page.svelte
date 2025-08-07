<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { RealtimeVoteTracker } from '$lib/realtime';
	import type { BallotWithVotes, VoteChoice } from '$lib/types';
	import { formatDateTime } from '$lib/utils/date';
	import VotingProgress from '$lib/components/VotingProgress.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import Modal from '$lib/components/Modal.svelte';
	// import OpenVotingModal from '$lib/components/OpenVotingModal.svelte';

	let ballot: BallotWithVotes | null = null;
	let loading = true;
	let error = '';
	let voting = false;
	let voteError = '';
	let realtimeTracker: RealtimeVoteTracker | null = null;
	let showOpenVotingModal = false;
	let selectedChoice: VoteChoice | null = null;

	$: ballotId = $page.params.id;
	$: isOpen = ballot?.status === 'open';
	$: isDraft = ballot?.status === 'draft';
	$: votingStarted = ballot ? new Date() >= new Date(ballot.voting_opens_at) : false;
	$: votingEnded = ballot ? new Date() > new Date(ballot.voting_closes_at) : false;
	$: canVote = isOpen && votingStarted && !votingEnded;
	$: isCreator = ballot && $page.data.user ? ballot.creator_id === $page.data.user.id : false;
	$: canOpenVoting = isDraft && isCreator;
	$: console.log({ ballot });

	$: votingOpensAt = '';
	$: votingClosesAt = '';
	$: sendNotifications = true;

	onMount(async () => {
		if (!ballotId) {
			goto('/ballots');
			return;
		}
		if (!$page.data.user) {
			goto('/auth');
			return;
		}

		await loadBallot();

		// Set up real-time tracking via cookie-authenticated SSE (no token needed)
		realtimeTracker = new RealtimeVoteTracker(ballotId);
		realtimeTracker.connect();

		// Subscribe to real-time updates
		realtimeTracker.data.subscribe((data) => {
			if (data && ballot) {
				ballot.vote_counts = data.vote_counts;
				ballot.user_vote = data.user_vote ?? undefined;
			}
		});
	});

	onDestroy(() => {
		if (realtimeTracker) {
			realtimeTracker.disconnect();
		}
	});

	async function loadBallot() {
		try {
			loading = true;

			const response = await fetch(`/api/ballots/${ballotId}`);

			if (response.ok) {
				const result = await response.json();
				ballot = result.ballot;
			} else if (response.status === 404) {
				error = 'Ballot not found';
			} else {
				error = 'Failed to load ballot';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handleSubmit() {
		if (!canVote || !selectedChoice) return;

		voting = true;
		voteError = '';

		try {
			const response = await fetch(`/api/ballots/${ballotId}/vote`, {
				method: 'POST',
				// headers: {
				// 	'Content-Type': 'application/json'
				// },
				body: JSON.stringify({ vote_choice: selectedChoice })
			});

			if (response.ok) {
				await loadBallot();
			} else {
				const errorData = await response.json();
				voteError = errorData.error || 'Failed to cast vote';
			}
		} catch (err) {
			voteError = 'Network error. Please try again.';
		} finally {
			voting = false;
		}
	}

	async function handleOpenVoting(payload: {
		votingOpensAt: string;
		votingClosesAt: string;
		sendNotifications: boolean;
	}) {
		const { votingOpensAt, votingClosesAt, sendNotifications } = payload;

		try {
			const response = await fetch(`/api/ballots/${ballotId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					action: 'open_voting',
					voting_opens_at: votingOpensAt,
					voting_closes_at: votingClosesAt,
					send_notifications: sendNotifications
				})
			});

			if (response.ok) {
				const result = await response.json();
				ballot = { ...ballot, ...result.ballot };
				showOpenVotingModal = false;
				// Reload ballot to get fresh data
				await loadBallot();
			} else {
				const errorData = await response.json();
				voteError = errorData.error || 'Failed to open voting';
			}
		} catch (err) {
			voteError = 'Network error. Please try again.';
		}
	}
</script>

<div class="container">
	{#if loading}
		<div class="loading">Loading ballot...</div>
	{:else if error}
		<div class="error">
			{error}
			<button on:click={loadBallot} class="btn btn-sm">Retry</button>
		</div>
	{:else if ballot}
		<div class="ballot-detail">
			<div class="ballot-header">
				<h1>{ballot.title}</h1>
				<span
					class="status-badge"
					class:open={ballot.status === 'open'}
					class:closed={ballot.status === 'closed'}
					class:draft={ballot.status === 'draft'}
				>
					{ballot.status}
				</span>
			</div>

			<div class="ballot-meta">
				<div><strong>Created:</strong> {formatDateTime(new Date(ballot.created_at))}</div>
				<div><strong>Voting Opens:</strong> {formatDateTime(new Date(ballot.voting_opens_at))}</div>
				<div>
					<strong>Voting Closes:</strong>
					{formatDateTime(new Date(ballot.voting_closes_at))}
				</div>
				{#if ballot.quorum_required}
					<div><strong>Quorum Required:</strong> {ballot.quorum_required} voters</div>
				{/if}
			</div>

			<div class="ballot-description">
				<h3>Description</h3>
				<Markdown content={ballot.description} />
			</div>

			{#if canOpenVoting}
				<div class="admin-actions">
					<button
						class="btn btn-primary open-voting-btn"
						on:click={() => (showOpenVotingModal = true)}
						aria-haspopup="dialog"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 6v6m0 0v6m0-6h6m-6 0H6"
							/>
						</svg>
						Open Voting
					</button>
					<p class="admin-help">
						This ballot is in draft status. Open voting to allow voters to cast their votes.
					</p>
				</div>
			{/if}

			{#if ballot.passing_status}
				<VotingProgress
					passingStatus={ballot.passing_status}
					votingThreshold={ballot.voting_threshold}
					customThresholdPercentage={ballot.threshold_percentage
						? parseFloat(ballot.threshold_percentage)
						: undefined}
				/>
			{/if}

			{#if canVote}
				<div class="voting-section">
					<h3>Cast Your Vote</h3>
					{#if ballot.user_vote}
						<p class="current-vote" aria-live="polite">
							You voted <strong>{ballot.user_vote.vote_choice.toUpperCase()}</strong>.
							<br /><small>Votes cannot be changed.</small>
						</p>
					{/if}

					{#if voteError}
						<div class="error" aria-live="polite">{voteError}</div>
					{/if}

					<form on:submit|preventDefault={handleSubmit} aria-live="polite">
						<div class="radio-group">
							<label class="radio-option" for="vote-yea">
								<span>Yea</span>
								<input
									id="vote-yea"
									type="radio"
									name="vote"
									value="yea"
									on:change={(e) =>
										(selectedChoice = (e.currentTarget as HTMLInputElement).value as VoteChoice)}
								/>
							</label>
							<label class="radio-option" for="vote-nay">
								<span>Nay</span>
								<input
									id="vote-nay"
									type="radio"
									name="vote"
									value="nay"
									on:change={(e) =>
										(selectedChoice = (e.currentTarget as HTMLInputElement).value as VoteChoice)}
								/>
							</label>
							<label class="radio-option" for="vote-abstain">
								<span>Abstain</span>
								<input
									id="vote-abstain"
									type="radio"
									name="vote"
									value="abstain"
									on:change={(e) =>
										(selectedChoice = (e.currentTarget as HTMLInputElement).value as VoteChoice)}
								/>
							</label>
						</div>
						<button
							type="submit"
							class="btn"
							disabled={voting || !selectedChoice || !!ballot.user_vote}
						>
							{voting ? 'Submitting...' : 'Submit Vote'}
						</button>
					</form>
				</div>
			{:else if !votingStarted}
				<div class="voting-info">
					<h3>Voting Not Yet Open</h3>
					<p>Voting will open on {formatDateTime(new Date(ballot.voting_opens_at))}</p>
				</div>
			{:else if votingEnded || ballot.status === 'closed'}
				<div class="voting-info">
					<h3>Voting Closed</h3>
					<p>Voting closed on {formatDateTime(new Date(ballot.voting_closes_at))}</p>
					{#if ballot.user_vote}
						<p>Your vote: <strong>{ballot.user_vote.vote_choice.toUpperCase()}</strong></p>
					{:else}
						<p>You did not vote on this ballot.</p>
					{/if}
				</div>
			{/if}

			<div class="actions">
				<a href="/ballots" class="btn btn-secondary">Back to Ballots</a>
			</div>
		</div>
	{/if}
</div>

<!-- Open Voting Modal (reusable) -->
<Modal bind:open={showOpenVotingModal} title="Open Voting" size="md" initialFocus="#voting-opens">
	<p class="ballot-info">
		You are about to open voting for: <strong>{ballot?.title || ''}</strong>
	</p>
	<form
		id="open-voting-form"
		on:submit|preventDefault={(e) => {
			const form = e.currentTarget as HTMLFormElement;
			// const opens = (form.querySelector('#voting-opens') as HTMLInputElement).value;
			// const closes = (form.querySelector('#voting-closes') as HTMLInputElement).value;
			// const notify = (form.querySelector('#send-notifications') as HTMLInputElement).checked;
			handleOpenVoting({ votingOpensAt, votingClosesAt, sendNotifications });
		}}
	>
		<div class="form-group">
			<label for="voting-opens">Voting Opens *</label>
			<input
				id="voting-opens"
				bind:value={votingOpensAt}
				type="datetime-local"
				required
				data-autofocus
			/>
			<small class="form-help">When voters can start casting their votes</small>
		</div>
		<div class="form-group">
			<label for="voting-closes">Voting Closes *</label>
			<input id="voting-closes" bind:value={votingClosesAt} type="datetime-local" required />
			<small class="form-help">When voting will automatically close</small>
		</div>
		<div class="form-group">
			<label class="checkbox-label">
				<input id="send-notifications" bind:checked={sendNotifications} type="checkbox" />
				<span class="checkbox-text">Send notification to voters</span>
			</label>
			<small class="form-help"
				>Notify all eligible voters that voting has started for this ballot</small
			>
		</div>
		{#if voteError}
			<div class="error" aria-live="polite">{voteError}</div>
		{/if}
	</form>

	<div slot="footer" class="modal-actions">
		<button type="button" class="btn btn-secondary" on:click={() => (showOpenVotingModal = false)}>
			Cancel
		</button>
		<button type="submit" form="open-voting-form" class="btn btn-primary">Open Voting</button>
	</div>
</Modal>

<style>
	.ballot-detail {
		max-width: 800px;
		margin: 0 auto;
	}

	.ballot-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
		gap: 1rem;
	}

	.ballot-header h1 {
		margin: 0;
		color: #333;
		flex: 1;
	}

	.status-badge {
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-weight: 500;
		font-size: 0.9rem;
		color: white;
		white-space: nowrap;
	}

	.status-badge.open {
		background: #28a745;
	}
	.status-badge.closed {
		background: #dc3545;
	}
	.status-badge.draft {
		background: #ffc107;
		color: #333;
	}

	.ballot-meta {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 2rem;
		font-size: 0.9rem;
	}

	.ballot-meta > div {
		margin-bottom: 0.5rem;
	}

	.ballot-meta > div:last-child {
		margin-bottom: 0;
	}

	.ballot-description {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 2rem;
	}

	.ballot-description h3 {
		margin-top: 0;
		color: #333;
	}

	.ballot-description p {
		line-height: 1.6;
		color: #555;
	}

	.admin-actions {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
	}

	.open-voting-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.admin-help {
		margin: 0;
		font-size: 0.875rem;
		color: #64748b;
		line-height: 1.5;
	}

	.voting-section,
	.voting-info {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		gap: 2rem;
		& form {
			display: contents;
		}
	}

	.voting-section h3,
	.voting-info h3 {
		margin-top: 0;
		color: #333;
	}

	.current-vote {
		background: #e3f2fd;
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		color: #1976d2;
	}
	.actions {
		text-align: center;
		margin-top: 2rem;
	}

	@media (max-width: 768px) {
		.ballot-header {
			flex-direction: column;
		}
	}
	.radio-option {
		& span,
		& input {
			flex: 1;
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}
		& input:active,
		& input:focus,
		& input:focus-within,
		& input:focus-visible,
		& input:hover {
			outline: none;
			border: 0;
			border-color: none;
			box-shadow: none;
		}
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-weight: normal;
		margin-bottom: 0;
		cursor: pointer;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		transition: background-color 0.2s;
		justify-content: space-between;
	}
	.radio-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
