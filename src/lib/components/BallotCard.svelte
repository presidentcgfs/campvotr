<script lang="ts">
	import type { BallotWithVotes } from '$lib/types';
	import { formatDistanceToNow } from '$lib/utils/date';
	import Markdown from './Markdown.svelte';

	export let ballot: BallotWithVotes;

	$: isOpen = ballot.status === 'open';
	$: isClosed = ballot.status === 'closed';
	$: votingEnded = new Date() > new Date(ballot.voting_closes_at);
	$: votingStarted = new Date() >= new Date(ballot.voting_opens_at);

	function getStatusColor(status: string) {
		switch (status) {
			case 'open':
				return '#28a745';
			case 'closed':
				return '#dc3545';
			case 'draft':
				return '#ffc107';
			default:
				return '#6c757d';
		}
	}

	function getStatusText(status: string) {
		switch (status) {
			case 'open':
				return 'Open for Voting';
			case 'closed':
				return 'Voting Closed';
			case 'draft':
				return 'Draft';
			default:
				return status;
		}
	}
	$: console.log(ballot);
</script>

<div class="ballot-card">
	<div class="ballot-header">
		<h3>
			<a href="/ballots/{ballot.id}">{ballot.title}</a>
		</h3>
		<span class="status-badge" style="background-color: {getStatusColor(ballot.status)}">
			{getStatusText(ballot.status)}
		</span>
	</div>

	<div class="ballot-description">
		<Markdown content={ballot.description} />
	</div>

	<div class="ballot-meta">
		<div class="voting-period">
			<strong>Voting Period:</strong>
			{new Date(ballot.voting_opens_at).toLocaleDateString()} -
			{new Date(ballot.voting_closes_at).toLocaleDateString()}
		</div>
		<div class="created-at">
			Created {formatDistanceToNow(new Date(ballot.created_at))} ago
		</div>
	</div>

	{#if ballot.vote_counts}
		<div class="vote-summary">
			<div class="vote-counts">
				<div class="vote-count yea">
					<span class="count">{ballot.vote_counts.yea}</span>
					<span class="label">Yea</span>
				</div>
				<div class="vote-count nay">
					<span class="count">{ballot.vote_counts.nay}</span>
					<span class="label">Nay</span>
				</div>
				<div class="vote-count abstain">
					<span class="count">{ballot.vote_counts.abstain}</span>
					<span class="label">Abstain</span>
				</div>
				<div class="vote-count total">
					<span class="count">{ballot.vote_counts.total}</span>
					<span class="label">Total</span>
				</div>
			</div>

			{#if ballot.user_vote}
				<div class="user-vote">
					Your vote: <strong>{ballot.user_vote.vote_choice.toUpperCase()}</strong>
				</div>
			{:else if isOpen && votingStarted && !votingEnded}
				<div class="no-vote">
					<a href="/ballots/{ballot.id}" class="btn btn-sm">Cast Your Vote</a>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.ballot-card {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 1rem;
		transition: box-shadow 0.2s;
	}

	.ballot-card:hover {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.ballot-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.ballot-header h3 {
		margin: 0;
		flex: 1;
	}

	.ballot-header h3 a {
		color: #007bff;
		text-decoration: none;
	}

	.ballot-header h3 a:hover {
		text-decoration: underline;
	}

	.status-badge {
		color: white;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.ballot-description {
		color: #666;
		margin-bottom: 1rem;
		line-height: 1.5;
	}

	.ballot-meta {
		font-size: 0.9rem;
		color: #888;
		margin-bottom: 1rem;
	}

	.ballot-meta > div {
		margin-bottom: 0.25rem;
	}

	.vote-summary {
		border-top: 1px solid #eee;
		padding-top: 1rem;
	}

	.vote-counts {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
	}

	.vote-count {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 60px;
	}

	.vote-count .count {
		font-size: 1.25rem;
		font-weight: bold;
	}

	.vote-count .label {
		font-size: 0.8rem;
		color: #666;
		text-transform: uppercase;
	}

	.vote-count.yea .count {
		color: #28a745;
	}
	.vote-count.nay .count {
		color: #dc3545;
	}
	.vote-count.abstain .count {
		color: #ffc107;
	}
	.vote-count.total .count {
		color: #007bff;
	}

	.user-vote {
		font-size: 0.9rem;
		color: #007bff;
		margin-top: 0.5rem;
	}

	.no-vote {
		margin-top: 0.5rem;
	}

	@media (max-width: 768px) {
		.ballot-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.vote-counts {
			justify-content: space-around;
		}
	}
</style>
