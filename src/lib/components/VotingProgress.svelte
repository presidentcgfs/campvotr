<script lang="ts">
	import type { PassingStatus } from '$lib/types';

	export let passingStatus: PassingStatus | null;

	export let votingThreshold: 'simple_majority' | 'supermajority' | 'unanimous' | 'custom';
	export let customThresholdPercentage: number | undefined = undefined;

	$: thresholdLabel = getThresholdLabel(votingThreshold, customThresholdPercentage);
	$: progressPercentage = passingStatus
		? Math.min(100, (passingStatus.vote_counts.yea / passingStatus.required_votes) * 100)
		: 0;
	$: failureReason = getFailureReason(passingStatus);

	function getThresholdLabel(threshold: string, customPercentage?: number): string {
		switch (threshold) {
			case 'simple_majority':
				return 'Simple Majority (50% + 1)';
			case 'supermajority':
				return 'Supermajority (2/3)';
			case 'unanimous':
				return 'Unanimous (100%)';
			case 'custom':
				return `Custom (${customPercentage || 50}%)`;
			default:
				return 'Simple Majority (50% + 1)';
		}
	}

	function getFailureReason(status: PassingStatus | null): string {
		if (!status || status.is_passing) return '';

		const meetsThreshold = status.vote_counts.yea >= status.required_votes;
		const meetsQuorum = status.quorum_met;

		if (!meetsQuorum && !meetsThreshold) {
			return 'Insufficient votes and quorum not met';
		} else if (!meetsQuorum) {
			return 'Quorum not met';
		} else if (!meetsThreshold) {
			return 'Insufficient votes to pass';
		}

		return '';
	}
</script>

{#if passingStatus}
	<div class="voting-progress">
		<div class="status-header">
			<div
				class="status-badge"
				class:passing={passingStatus.is_passing}
				class:failing={!passingStatus.is_passing}
			>
				{passingStatus.is_passing
					? '✓ PASSING'
					: `✗ FAILING${failureReason ? ': ' + failureReason : ''}`}
			</div>
			<div class="threshold-info">
				<strong>Threshold:</strong>
				{thresholdLabel}
			</div>
			{#if passingStatus.quorum_required}
				<div class="quorum-info">
					<strong>Quorum:</strong>
					{passingStatus.quorum_required} voters required
					<span
						class="quorum-status"
						class:met={passingStatus.quorum_met}
						class:not-met={!passingStatus.quorum_met}
					>
						({passingStatus.quorum_met ? '✓ Met' : '✗ Not Met'})
					</span>
				</div>
			{/if}
		</div>

		<div class="progress-section">
			<div class="progress-header">
				<span class="progress-label">
					{passingStatus.vote_counts.yea} of {passingStatus.required_votes} votes needed to pass
				</span>
				<span class="progress-percentage">
					{passingStatus.current_percentage.toFixed(1)}% of eligible voters
				</span>
			</div>

			<div class="progress-bar">
				<div
					class="progress-fill"
					class:passing={passingStatus.is_passing}
					style="width: {progressPercentage}%"
				></div>
			</div>

			<div class="progress-details">
				<div class="detail-item">
					<span class="detail-label">Votes Cast:</span>
					<span class="detail-value"
						>{passingStatus.total_votes_cast} / {passingStatus.total_eligible_voters}</span
					>
				</div>
				<div class="detail-item">
					<span class="detail-label">Still Needed:</span>
					<span class="detail-value">{passingStatus.votes_needed} more "Yes" votes</span>
				</div>
				{#if passingStatus.quorum_required}
					<div class="detail-item">
						<span class="detail-label">Quorum Progress:</span>
						<span class="detail-value">
							{passingStatus.total_votes_cast} / {passingStatus.quorum_required}
							{#if passingStatus.quorum_needed && passingStatus.quorum_needed > 0}
								({passingStatus.quorum_needed} more needed)
							{/if}
						</span>
					</div>
				{/if}
			</div>
		</div>

		<div class="vote-breakdown">
			<div class="vote-item yea">
				<div class="vote-count">{passingStatus.vote_counts.yea}</div>
				<div class="vote-label">Yes</div>
			</div>
			<div class="vote-item nay">
				<div class="vote-count">{passingStatus.vote_counts.nay}</div>
				<div class="vote-label">No</div>
			</div>
			<div class="vote-item abstain">
				<div class="vote-count">{passingStatus.vote_counts.abstain}</div>
				<div class="vote-label">Abstain</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.voting-progress {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.status-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
		gap: 1rem;
	}

	.status-badge {
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-weight: bold;
		font-size: 0.875rem;
		text-align: center;
	}

	.status-badge.passing {
		background-color: #d4edda;
		color: #155724;
		border: 1px solid #c3e6cb;
	}

	.status-badge.failing {
		background-color: #f8d7da;
		color: #721c24;
		border: 1px solid #f5c6cb;
	}

	.threshold-info {
		color: #666;
		font-size: 0.875rem;
	}

	.quorum-info {
		color: #666;
		font-size: 0.875rem;
	}

	.quorum-status.met {
		color: #155724;
		font-weight: 500;
	}

	.quorum-status.not-met {
		color: #721c24;
		font-weight: 500;
	}

	.progress-section {
		margin-bottom: 1.5rem;
	}

	.progress-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.progress-label {
		font-weight: 500;
		color: #333;
	}

	.progress-percentage {
		color: #666;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background-color: #e9ecef;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 1rem;
	}

	.progress-fill {
		height: 100%;
		background-color: #ffc107;
		transition: width 0.3s ease;
	}

	.progress-fill.passing {
		background-color: #28a745;
	}

	.progress-details {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
		color: #666;
	}

	.detail-item {
		display: flex;
		gap: 0.5rem;
	}

	.detail-label {
		font-weight: 500;
	}

	.vote-breakdown {
		display: flex;
		justify-content: space-around;
		gap: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e9ecef;
	}

	.vote-item {
		text-align: center;
		flex: 1;
	}

	.vote-count {
		font-size: 1.5rem;
		font-weight: bold;
		margin-bottom: 0.25rem;
	}

	.vote-label {
		font-size: 0.875rem;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.vote-item.yea .vote-count {
		color: #28a745;
	}

	.vote-item.nay .vote-count {
		color: #dc3545;
	}

	.vote-item.abstain .vote-count {
		color: #6c757d;
	}

	@media (max-width: 768px) {
		.status-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.progress-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.progress-details {
			flex-direction: column;
			gap: 0.5rem;
		}

		.vote-breakdown {
			flex-direction: column;
			gap: 0.75rem;
		}
	}
</style>
