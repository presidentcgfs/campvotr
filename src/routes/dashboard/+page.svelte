<script lang="ts">
	import BallotCard from '$lib/components/BallotCard.svelte';
	import Button from '$lib/components/Button.svelte';
	import type { BallotWithVotes } from '$lib/types';
	export let data: {
		openBallots: BallotWithVotes[];
		recentBallots: BallotWithVotes[];
		totalBallots: number;
		canCreateBallot: boolean;
	};
	$: openBallots = data.openBallots;
	$: recentBallots = data.recentBallots;
</script>

<div class="container">
	<div class="dashboard-grid">
		<!-- Quick Stats -->
		<div class="stats-section">
			<h2>Quick Stats</h2>
			<div class="stats-grid">
				<div class="stat-card">
					<div class="stat-number">{openBallots.length}</div>
					<div class="stat-label">Open Ballots</div>
				</div>
				<div class="stat-card">
					<div class="stat-number">{recentBallots.length}</div>
					<div class="stat-label">My Ballots</div>
				</div>
			</div>
		</div>

		<!-- Recent Ballots -->
		<div class="ballots-section">
			<div class="section-header">
				<h2>Recent Ballots</h2>
				<Button href="/ballots" class="view-all">View All</Button>
			</div>

			{#if recentBallots.length === 0 && data.canCreateBallot}
				<p class="empty-message">
					No ballots yet. <Button href="/ballots?create">Create your first ballot</Button>.
				</p>
			{:else}
				<div class="ballots-list">
					{#each recentBallots as ballot (ballot.id)}
						<BallotCard {ballot} />
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.dashboard-grid {
		display: grid;
		gap: 2rem;
		margin-bottom: 3rem;
	}

	.stats-section {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.stats-section h2 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #333;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.stat-card {
		text-align: center;
		padding: 1.5rem;
		background: #f8f9fa;
		border-radius: 8px;
		border: 2px solid transparent;
		transition: border-color 0.2s;
	}

	.stat-card:hover {
		border-color: #007bff;
	}

	.stat-number {
		font-size: 2.5rem;
		font-weight: bold;
		color: #007bff;
		margin-bottom: 0.5rem;
	}

	.stat-label {
		color: #666;
		font-size: 0.9rem;
		text-transform: uppercase;
		font-weight: 500;
	}

	.ballots-section {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.section-header h2 {
		margin: 0;
		color: #333;
	}

	.empty-message {
		color: #666;
		text-align: center;
		padding: 2rem;
		font-style: italic;
	}

	.ballots-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media (max-width: 768px) {
		.dashboard-grid {
			gap: 1rem;
		}

		.stats-grid {
			grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		}

		.stat-number {
			font-size: 2rem;
		}

		.section-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}
	}
</style>
