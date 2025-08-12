<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { RealtimeVoteTracker } from '$lib/realtime';
	import type { BallotWithVotes, VoteChoice } from '$lib/types';
	import { formatDateTime } from '$lib/utils/date';
	import VotingProgress from '$lib/components/VotingProgress.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import TieBreakResolver from '$lib/components/TieBreakResolver.svelte';
	import OpenVotingModal from '$lib/components/OpenVotingModal.svelte';
	import Button from '$lib/components/Button.svelte';
	import { invalidate } from '$app/navigation';

	// import OpenVotingModal from '$lib/components/OpenVotingModal.svelte';
	export let data: { ballot: BallotWithVotes };

	let ballot: BallotWithVotes = data.ballot;
	let voting = false;
	let voteError = '';
	let realtimeTracker: RealtimeVoteTracker | null = null;
	let showOpenVotingModal = false;
	let selectedChoice: VoteChoice | null = null;

	$: isOpen = ballot?.status === 'open';
	$: isDraft = ballot?.status === 'draft';
	$: votingStarted = ballot ? new Date() >= new Date(ballot.voting_opens_at) : false;
	$: votingEnded = ballot ? new Date() > new Date(ballot.voting_closes_at) : false;
	$: canVote = isOpen && votingStarted && !votingEnded;
	$: isCreator = ballot && $page.data.user ? ballot.creator_id === $page.data.user.id : false;
	$: canOpenVoting = ballot?.status != 'closed' && isCreator;

	onMount(async () => {
		// Set up real-time tracking via cookie-authenticated SSE (no token needed)
		realtimeTracker = new RealtimeVoteTracker(ballot.id);
		realtimeTracker.connect();

		// Subscribe to real-time updates
		realtimeTracker.data.subscribe((data) => {
			if (data) {
				ballot = {
					...ballot,
					vote_counts: data.vote_counts,
					user_vote: data.user_vote ?? undefined
				};
			}
		});
	});

	onDestroy(() => {
		realtimeTracker?.disconnect();
	});
</script>

<div class="container">
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
				<Button onclick={() => (showOpenVotingModal = true)} aria-haspopup="dialog">
					<svg
						slot="icon"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6v6m0 0v6m0-6h6m-6 0H6"
						/>
					</svg>
					Open Voting
				</Button>
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

			{#if votingEnded || ballot.status === 'closed'}
				<TieBreakResolver ballotId={ballot.id} />
			{/if}
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

				<form action="?/vote" aria-live="polite" method="POST">
					<input type="hidden" name="ballot_id" value={ballot.id} />
					<div class="radio-group">
						<label class="radio-option" for="vote-yea">
							<span>Yea</span>
							<input
								id="vote-yea"
								type="radio"
								name="vote_choice"
								value="yea"
								bind:group={selectedChoice}
							/>
						</label>
						<label class="radio-option" for="vote-nay">
							<span>Nay</span>
							<input
								id="vote-nay"
								type="radio"
								name="vote_choice"
								value="nay"
								bind:group={selectedChoice}
							/>
						</label>
						<label class="radio-option" for="vote-abstain">
							<span>Abstain</span>
							<input
								id="vote-abstain"
								type="radio"
								name="vote_choice"
								value="abstain"
								bind:group={selectedChoice}
							/>
						</label>
					</div>
					<Button disabled={voting || !selectedChoice || !!ballot.user_vote}>
						{voting ? 'Submitting...' : 'Submit Vote'}
					</Button>
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
</div>
<OpenVotingModal
	bind:open={showOpenVotingModal}
	ballotTitle={ballot.title}
	ballotId={ballot.id}
	onOpen={() => invalidate('app:ballots')}
/>

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

	.admin-actions {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
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
