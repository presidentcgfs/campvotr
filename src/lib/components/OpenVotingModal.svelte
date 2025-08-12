<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatISOLocal, tomorrow } from '$lib/utils/date';
	import Button from './Button.svelte';
	import Modal from './Modal.svelte';

	export let open = false;
	export let ballotTitle = '';
	export let ballotId: string;
	export let error: string | undefined = undefined;
	export let onOpen = () => {};
</script>

<Modal bind:open title="Open Voting" size="md" initialFocus="#voting-opens">
	<p class="ballot-info">
		You are about to open voting for: <strong>{ballotTitle}</strong>
	</p>

	<form
		action={`/api/ballots/${ballotId}/open`}
		use:enhance={({ formElement, formData, action, cancel, submitter }) => {
			// `formElement` is this `<form>` element
			// `formData` is its `FormData` object that's about to be submitted
			// `action` is the URL to which the form is posted
			// calling `cancel()` will prevent the submission
			// `submitter` is the `HTMLElement` that caused the form to be submitted

			return async ({ result, update }) => {
				await update();
				if (result?.type === 'error') {
					error = 'Failed to open voting.';
				} else {
					onOpen();
					open = false;
				}
				// `result` is an `ActionResult` object
				// `update` is a function which triggers the default logic that would be triggered if this callback wasn't set
			};
		}}
		method="POST"
		id="open-voting-form"
	>
		<input type="hidden" name="ballot_id" value={ballotId} />
		<div class="form-group">
			<label for="voting-opens">Voting Opens *</label>
			<input
				id="voting-opens"
				type="datetime-local"
				name="voting_opens_at"
				value={formatISOLocal()}
				required
				data-autofocus
			/>
			<small class="form-help">When voters can start casting their votes</small>
		</div>

		<div class="form-group">
			<label for="voting-closes">Voting Closes *</label>
			<input
				id="voting-closes"
				name="voting_closes_at"
				type="datetime-local"
				value={formatISOLocal(tomorrow())}
				required
			/>
			<small class="form-help">When voting will automatically close</small>
		</div>

		<div class="form-group">
			<label class="checkbox-label">
				<input type="checkbox" name="send_notifications" checked={true} />
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

	<div slot="footer">
		<Button variant="secondary" onclick={() => (open = false)}>Cancel</Button>
		<Button type="submit" action="submit" form="open-voting-form">Open Voting</Button>
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
</style>
