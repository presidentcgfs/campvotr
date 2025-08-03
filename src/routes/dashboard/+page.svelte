<script lang="ts">
	import { onMount } from 'svelte';
	import BallotCard from '$lib/components/BallotCard.svelte';
	import type { BallotWithVotes, Notification } from '$lib/types';

	let recentBallots: BallotWithVotes[] = [];
	let notifications: Notification[] = [];
	let loading = true;
	let error = '';

	onMount(async () => {
		await Promise.all([loadRecentBallots(), loadNotifications()]);
		loading = false;
	});

	async function loadRecentBallots() {
		try {
			const response = await fetch('/api/ballots?limit=5');

			if (response.ok) {
				const result = await response.json();
				recentBallots = result.ballots;
			}
		} catch (err) {
			console.error('Failed to load recent ballots:', err);
		}
	}

	async function loadNotifications() {
		try {
			const response = await fetch('/api/notifications');

			if (response.ok) {
				const result = await response.json();
				notifications = result.notifications.slice(0, 5); // Show only 5 most recent
			}
		} catch (err) {
			console.error('Failed to load notifications:', err);
		}
	}

	async function markNotificationAsRead(notificationId: string) {
		try {
			const response = await fetch(`/api/notifications/${notificationId}/read`, {
				method: 'POST'
			});

			if (response.ok) {
				// Update the notification in the list
				notifications = notifications.map((n) =>
					n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
				);
			}
		} catch (err) {
			console.error('Failed to mark notification as read:', err);
		}
	}

	$: unreadNotifications = notifications.filter((n) => !n.read_at);
	$: openBallots = recentBallots.filter((d) => d.status === 'open');
	import { page } from '$app/stores';
	let currentUserEmail = '';
	let currentUserId = '';
	$: ({ user: { email: currentUserEmail = '', id: currentUserId = '' } = {} as any } =
		$page.data as any);
	$: myBallots = recentBallots.filter((d) => d.creator_id === currentUserId);
</script>

<div class="container">
	<div class="dashboard-header">
		<h1>Dashboard</h1>
		<p>Welcome back, {currentUserEmail}!</p>
	</div>

	{#if loading}
		<div class="loading">Loading dashboard...</div>
	{:else}
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
						<div class="stat-number">{myBallots.length}</div>
						<div class="stat-label">My Ballots</div>
					</div>
					<div class="stat-card">
						<div class="stat-number">{unreadNotifications.length}</div>
						<div class="stat-label">Unread Notifications</div>
					</div>
				</div>
			</div>

			<!-- Recent Notifications -->
			<div class="notifications-section">
				<div class="section-header">
					<h2>Recent Notifications</h2>
					<a href="/notifications" class="view-all">View All</a>
				</div>

				{#if notifications.length === 0}
					<p class="empty-message">No notifications yet.</p>
				{:else}
					<div class="notifications-list">
						{#each notifications as notification (notification.id)}
							<div class="notification-item" class:unread={!notification.read_at}>
								<div class="notification-content">
									<p>{notification.message}</p>
									<small>{new Date(notification.sent_at).toLocaleDateString()}</small>
								</div>
								{#if !notification.read_at}
									<button
										on:click={() => markNotificationAsRead(notification.id)}
										class="mark-read-btn"
									>
										Mark Read
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Recent Ballots -->
			<div class="ballots-section">
				<div class="section-header">
					<h2>Recent Ballots</h2>
					<a href="/ballots" class="view-all">View All</a>
				</div>

				{#if recentBallots.length === 0}
					<p class="empty-message">
						No ballots yet. <a href="/ballots">Create your first ballot</a>.
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

		<!-- Quick Actions -->
		<div class="quick-actions">
			<h2>Quick Actions</h2>
			<div class="actions-grid">
				<a href="/ballots" class="action-card">
					<h3>📋 View All Ballots</h3>
					<p>Browse and vote on all available ballots</p>
				</a>
				<a href="/ballots" class="action-card">
					<h3>➕ Create New Ballot</h3>
					<p>Start a new voting proposal</p>
				</a>
				<a href="/notifications" class="action-card">
					<h3>🔔 View Notifications</h3>
					<p>Check all your notifications and updates</p>
				</a>
			</div>
		</div>
	{/if}
</div>

<style>
	.dashboard-header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.dashboard-header h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}

	.dashboard-header p {
		color: #666;
		font-size: 1.1rem;
	}

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

	.notifications-section,
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

	.view-all {
		color: #007bff;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.view-all:hover {
		text-decoration: underline;
	}

	.empty-message {
		color: #666;
		text-align: center;
		padding: 2rem;
		font-style: italic;
	}

	.notifications-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.notification-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1rem;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		gap: 1rem;
	}

	.notification-item.unread {
		background: #f0f8ff;
		border-color: #007bff;
	}

	.notification-content {
		flex: 1;
	}

	.notification-content p {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.notification-content small {
		color: #666;
	}

	.mark-read-btn {
		background: #007bff;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		white-space: nowrap;
	}

	.mark-read-btn:hover {
		background: #0056b3;
	}

	.ballots-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.quick-actions {
		background: white;
		padding: 2rem;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.quick-actions h2 {
		margin-top: 0;
		margin-bottom: 1.5rem;
		color: #333;
		text-align: center;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}

	.action-card {
		display: block;
		padding: 1.5rem;
		background: #f8f9fa;
		border: 2px solid transparent;
		border-radius: 8px;
		text-decoration: none;
		color: inherit;
		transition: all 0.2s;
	}

	.action-card:hover {
		border-color: #007bff;
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}

	.action-card h3 {
		margin: 0 0 0.5rem 0;
		color: #333;
	}

	.action-card p {
		margin: 0;
		color: #666;
		font-size: 0.9rem;
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

		.notification-item {
			flex-direction: column;
			align-items: stretch;
		}

		.mark-read-btn {
			align-self: flex-start;
		}

		.actions-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
