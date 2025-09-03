<script lang="ts">
	import { formatDistanceToNow } from '$lib/utils/date';

	interface DrawSession {
		id: string;
		name: string;
		status: 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
		turnStrategy: 'fixed' | 'randomized' | 'snake' | 'random' | 'round_robin';
		rounds: number | null;
		pickTimeoutSec: number;
		startsAtUtc: Date | string | null;
		startDate: Date | string;
		endDate: Date | string;
		createdAt: Date | string;
		updatedAt: Date | string;
		participantCount: number;
	}

	interface Props {
		session: DrawSession;
	}

	let { session }: Props = $props();

	let isOpen = $derived(['active', 'scheduled'].includes(session.status));
	let hasStarted = $derived(session.status === 'active');

	function getStatusColor(status: string) {
		switch (status) {
			case 'active':
				return '#28a745';
			case 'scheduled':
				return '#007bff';
			case 'paused':
				return '#ffc107';
			case 'completed':
				return '#6c757d';
			case 'cancelled':
				return '#dc3545';
			default:
				return '#6c757d';
		}
	}

	function getStatusText(status: string) {
		switch (status) {
			case 'active':
				return 'Active';
			case 'scheduled':
				return 'Scheduled';
			case 'paused':
				return 'Paused';
			case 'completed':
				return 'Completed';
			case 'cancelled':
				return 'Cancelled';
			default:
				return status;
		}
	}

	function formatTurnStrategy(strategy: string) {
		switch (strategy) {
			case 'fixed':
				return 'Fixed Order';
			case 'randomized':
				return 'Random Order';
			case 'snake':
				return 'Snake Draft';
			case 'round_robin':
				return 'Round Robin';
			case 'random':
				return 'Random';
			default:
				return strategy;
		}
	}
</script>

<div class="draw-session-card">
	<div class="session-header">
		<h3>
			<a href="/draw/{session.id}">{session.name}</a>
		</h3>
		<span class="status-badge" style="background-color: {getStatusColor(session.status)}">
			{getStatusText(session.status)}
		</span>
	</div>

	<div class="session-meta">
		<div class="meta-item">
			<strong>Strategy:</strong>
			{formatTurnStrategy(session.turnStrategy)}
		</div>
		<div class="meta-item">
			<strong>Participants:</strong>
			{session.participantCount}
		</div>
		{#if session.rounds}
			<div class="meta-item">
				<strong>Rounds:</strong>
				{session.rounds}
			</div>
		{/if}
		<div class="meta-item">
			<strong>Duration:</strong>
			{new Date(session.startDate).toLocaleDateString()} -
			{new Date(session.endDate).toLocaleDateString()}
		</div>
		{#if session.startsAtUtc}
			<div class="meta-item">
				<strong>Starts:</strong>
				{new Date(session.startsAtUtc).toLocaleString()}
			</div>
		{/if}
		<div class="created-at">
			Created {formatDistanceToNow(new Date(session.createdAt))} ago
		</div>
	</div>

	<div class="session-actions">
		{#if isOpen}
			<a href="/draw/{session.id}" class="btn btn-primary">
				{hasStarted ? 'Join Draw' : 'View Details'}
			</a>
		{:else}
			<a href="/draw/{session.id}" class="btn btn-secondary">View Results</a>
		{/if}
	</div>
</div>

<style>
	.draw-session-card {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 1rem;
		transition: box-shadow 0.2s;
	}

	.draw-session-card:hover {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.session-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1rem;
		gap: 1rem;
	}

	.session-header h3 {
		margin: 0;
		flex: 1;
	}

	.session-header h3 a {
		color: #007bff;
		text-decoration: none;
	}

	.session-header h3 a:hover {
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

	.session-meta {
		font-size: 0.9rem;
		color: #666;
		margin-bottom: 1rem;
	}

	.meta-item {
		margin-bottom: 0.25rem;
	}

	.created-at {
		color: #888;
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}

	.session-actions {
		border-top: 1px solid #eee;
		padding-top: 1rem;
	}

	.btn {
		display: inline-block;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-primary {
		background-color: #007bff;
		color: white;
	}

	.btn-primary:hover {
		background-color: #0056b3;
	}

	.btn-secondary {
		background-color: #6c757d;
		color: white;
	}

	.btn-secondary:hover {
		background-color: #545b62;
	}

	@media (max-width: 768px) {
		.session-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
