<script lang="ts">
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

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
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

{#if isOpen}
	<div
		class="modal-backdrop"
		on:click={handleBackdropClick}
		on:keydown={(e) => e.key === 'Escape' && closeModal()}
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
		tabindex="-1"
	>
		<div class="modal-content">
			<div class="modal-header">
				<h2 id="modal-title">Open Voting</h2>
				<button
					class="close-button"
					on:click={closeModal}
					disabled={loading}
					aria-label="Close modal"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="modal-body">
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

					<div class="modal-actions">
						<button
							type="button"
							class="btn btn-secondary"
							on:click={closeModal}
							disabled={loading}
						>
							Cancel
						</button>
						<button type="submit" class="btn btn-primary" disabled={loading}>
							{loading ? 'Opening Voting...' : 'Open Voting'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-content {
		background: white;
		border-radius: 8px;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
		max-width: 500px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem 1.5rem 0;
		border-bottom: 1px solid #e5e7eb;
		margin-bottom: 1.5rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
	}

	.close-button {
		background: none;
		border: none;
		padding: 0.5rem;
		cursor: pointer;
		color: #6b7280;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-button:hover:not(:disabled) {
		background: #f3f4f6;
		color: #374151;
	}

	.close-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-body {
		padding: 0 1.5rem 1.5rem;
	}

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
