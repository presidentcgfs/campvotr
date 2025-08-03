<script lang="ts">
	import { onMount } from 'svelte';
	import type { Notification } from '$lib/types';

	let notifications: Notification[] = [];
	let loading = true;
	let error = '';

	onMount(async () => {
		await loadNotifications();
	});

	async function loadNotifications() {
		try {
			loading = true;
			const response = await fetch('/api/notifications');

			if (response.ok) {
				const result = await response.json();
				notifications = result.notifications;
			} else {
				error = 'Failed to load notifications';
			}
		} catch (err) {
			error = 'Network error. Please try again.';
		} finally {
			loading = false;
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

	async function markAllAsRead() {
		const unreadNotifications = notifications.filter((n) => !n.read_at);

		// Mark all unread notifications as read
		await Promise.all(unreadNotifications.map((n) => markNotificationAsRead(n.id)));
	}

	$: unreadCount = notifications.filter((n) => !n.read_at).length;
</script>

<div class="container">
	<div class="page-header">
		<h1>Notifications</h1>
		{#if unreadCount > 0}
			<button on:click={markAllAsRead} class="btn btn-sm">
				Mark All Read ({unreadCount})
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="loading">Loading notifications...</div>
	{:else if error}
		<div class="error">
			{error}
			<button on:click={loadNotifications} class="btn btn-sm">Retry</button>
		</div>
	{:else if notifications.length === 0}
		<div class="empty-state">
			<h3>No notifications</h3>
			<p>
				You don't have any notifications yet. When new ballots are created or voting periods are
				about to close, you'll see them here.
			</p>
			<a href="/dashboard" class="btn">Back to Dashboard</a>
		</div>
	{:else}
		<div class="notifications-list">
			{#each notifications as notification (notification.id)}
				<div class="notification-card" class:unread={!notification.read_at}>
					<div class="notification-header">
						<div class="notification-type">
							{#if notification.type === 'new_ballot'}
								📋 New Ballot
							{:else if notification.type === 'voting_reminder'}
								⏰ Voting Reminder
							{:else if notification.type === 'voting_closed'}
								🔒 Voting Closed
							{:else}
								📢 Notification
							{/if}
						</div>
						<div class="notification-date">
							{new Date(notification.sent_at).toLocaleDateString()}
						</div>
					</div>

					<div class="notification-content">
						<p>{notification.message}</p>
					</div>

					<div class="notification-actions">
						{#if notification.ballot_id}
							<a href="/ballots/{notification.ballot_id}" class="btn btn-sm btn-secondary">
								View Ballot
							</a>
						{/if}
						{#if !notification.read_at}
							<button on:click={() => markNotificationAsRead(notification.id)} class="btn btn-sm">
								Mark Read
							</button>
						{:else}
							<span class="read-indicator">✓ Read</span>
						{/if}
					</div>
				</div>
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

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
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
		max-width: 500px;
		margin-left: auto;
		margin-right: auto;
		line-height: 1.6;
	}

	.notifications-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.notification-card {
		background: white;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		transition: all 0.2s;
	}

	.notification-card.unread {
		background: #f0f8ff;
		border-color: #007bff;
		border-left: 4px solid #007bff;
	}

	.notification-card:hover {
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.notification-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.notification-type {
		font-weight: 500;
		color: #007bff;
		font-size: 0.9rem;
	}

	.notification-date {
		color: #666;
		font-size: 0.8rem;
	}

	.notification-content {
		margin-bottom: 1rem;
	}

	.notification-content p {
		margin: 0;
		color: #333;
		line-height: 1.5;
	}

	.notification-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.read-indicator {
		color: #28a745;
		font-size: 0.9rem;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.page-header {
			flex-direction: column;
			align-items: stretch;
		}

		.notification-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.notification-actions {
			flex-direction: column;
			align-items: stretch;
		}

		.notification-actions .btn {
			width: 100%;
		}
	}
</style>
