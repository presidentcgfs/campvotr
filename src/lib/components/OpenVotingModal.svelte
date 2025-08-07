<script lang="ts">
	import Modal from './Modal.svelte';

	interface OpenVotingConfirmPayload {
		votingOpensAt: string;
		votingClosesAt: string;
		sendNotifications: boolean;
	}

	export let isOpen = false;
	export let ballotTitle = '';
	export let onConfirm: ((payload: OpenVotingConfirmPayload) => void) | undefined;

	let loading = false;
	let error = '';

	// Default to current time and 24 hours from now
	const now = new Date();
	const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

	let votingOpensAt = now.toISOString().slice(0, 16);
	let votingClosesAt = tomorrow.toISOString().slice(0, 16);
	let sendNotifications = true;

	function closeModal() {
		if (!loading) {
			isOpen = false;
			error = '';
			// Reset to defaults
			const newNow = new Date();
			const newTomorrow = new Date(newNow.getTime() + 24 * 60 * 60 * 1000);
			votingOpensAt = newNow.toISOString().slice(0, 16);
			votingClosesAt = newTomorrow.toISOString().slice(0, 16);
			sendNotifications = true;
		}
	}

	async function handleSubmit() {
		if (loading) return;

		// Validate times
		const opensAt = new Date(votingOpensAt);
		const closesAt = new Date(votingClosesAt);
		const currentTime = new Date();

		if (opensAt < currentTime) {
			error = 'Voting open time cannot be in the past';
			return;
		}

		if (closesAt <= opensAt) {
			error = 'Voting close time must be after open time';
			return;
		}

		loading = true;
		error = '';

		try {
			onConfirm?.({
				votingOpensAt,
				votingClosesAt,
				sendNotifications
			});
		} catch (err) {
			error = 'Failed to open voting. Please try again.';
			loading = false;
		}
	}

	// Handle successful submission from parent
	export function handleSuccess() {
		loading = false;
		closeModal();
	}

	// Handle error from parent
	export function handleError(errorMessage: string) {
		loading = false;
		error = errorMessage;
	}
</script>

<Modal bind:open={isOpen} title="Open Voting" size="md" initialFocus="#voting-opens">
	<p class="ballot-info">
		You are about to open voting for: <strong>{ballotTitle}</strong>
	</p>

	<form on:submit|preventDefault={handleSubmit}>
		<div class="form-group">
			<label for="voting-opens">Voting Opens *</label>
			<input
				id="voting-opens"
				type="datetime-local"
				bind:value={votingOpensAt}
				required
				disabled={loading}
				data-autofocus
			/>
			<small class="form-help">When voters can start casting their votes</small>
		</div>

		<div class="form-group">
			<label for="voting-closes">Voting Closes *</label>
			<input
				id="voting-closes"
				type="datetime-local"
				bind:value={votingClosesAt}
				required
				disabled={loading}
			/>
			<small class="form-help">When voting will automatically close</small>
		</div>

		<div class="form-group">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={sendNotifications} disabled={loading} />
				<span class="checkbox-text">Send notification to voters</span>
			</label>
			<small class="form-help">
				Notify all eligible voters that voting has started for this ballot
			</small>
		</div>

		{#if error}
			<div class="error-message">{error}</div>
		{/if}
	</form>

	<div slot="footer" class="modal-actions">
		<button type="button" class="btn btn-secondary" on:click={closeModal} disabled={loading}>
			Cancel
		</button>
		<button type="submit" formnovalidate class="btn btn-primary" disabled={loading}>
			{loading ? 'Opening Voting...' : 'Open Voting'}
		</button>
	</div>
</Modal>

<style>
	.ballot-info {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 1rem;
		margin-bottom: 1.5rem;
		color: #475569;
		line-height: 1.5;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #374151;
	}

	.form-group input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		transition: border-color 0.2s;
	}

	.form-group input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-group input:disabled {
		background: #f9fafb;
		color: #6b7280;
		cursor: not-allowed;
	}

	.form-help {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-weight: 500;
		color: #374151;
	}

	.checkbox-label input[type='checkbox'] {
		width: auto;
		margin: 0;
		cursor: pointer;
	}

	.checkbox-text {
		user-select: none;
	}

	.error-message {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #dc2626;
		padding: 0.75rem;
		border-radius: 6px;
		margin-bottom: 1.5rem;
		font-size: 0.875rem;
	}

	.modal-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		font-weight: 500;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #374151;
		border-color: #d1d5db;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f9fafb;
		border-color: #9ca3af;
	}

	.btn-primary {
		background: #3b82f6;
		color: white;
	}
	.btn-primary:hover:not(:disabled) {
		background: #2563eb;
	}
</style>
