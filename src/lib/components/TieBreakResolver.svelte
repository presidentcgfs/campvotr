<script lang="ts">
	import { onMount } from 'svelte';
	export let ballotId: string;

	type VoteChoice = 'yea' | 'nay' | 'abstain';
	let canAct = false;
	let designated: string | null = null;
	let tied: VoteChoice[] = [];
	let tieBreakerApplied = false;
	let loading = true;
	let error = '';
	let note = '';
	let submitting = false;

	async function refresh() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`/api/ballots/${ballotId}/tie-breaker`);
			const data = await res.json();
			designated = data.designated_user_id;
			canAct = data.can_act;
			tied = data.tie_status?.tiedChoices ?? [];
			tieBreakerApplied = !!data.tie_status?.tieBreakerApplied;
		} catch (e: any) {
			error = e.message ?? 'Failed to load tie status';
		} finally {
			loading = false;
		}
	}
	onMount(refresh);

	async function resolve(choice: VoteChoice) {
		if (!canAct) return;
		submitting = true;
		error = '';
		try {
			const res = await fetch(`/api/ballots/${ballotId}/tie-break`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ vote_choice: choice, note })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || 'Failed to resolve tie');
			}
			await refresh();
		} catch (e: any) {
			error = e.message ?? 'Failed to resolve tie';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="tie">
	{#if loading}
		<p>Loading tie status…</p>
	{:else if error}
		<p class="error">{error}</p>
	{:else if canAct && tied.length > 1}
		<div class="panel" aria-live="polite">
			<h3>Resolve Tie</h3>
			<p>Select one of the tied options below. Your decision is final.</p>
			<div class="options">
				{#each tied as c}
					<button class="btn" disabled={submitting} on:click={() => resolve(c)}>
						Choose {c.toUpperCase()}
					</button>
				{/each}
			</div>
			<label
				>Note (optional)
				<textarea bind:value={note} rows="3" aria-label="Tie-breaker note"></textarea>
			</label>
		</div>
	{:else if tied.length > 1}
		<div class="panel">
			<h3>Awaiting tie-breaker decision</h3>
			<p>A designated tie-breaker will decide the outcome.</p>
		</div>
	{:else if tieBreakerApplied}
		<div class="panel" aria-live="polite">
			<span class="badge">Decided by Tie-Breaker</span>
		</div>
	{/if}
</div>

<style>
	.error {
		color: #dc2626;
	}
	.panel {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		padding: 1rem;
	}
	.options {
		display: flex;
		gap: 0.5rem;
		margin: 0.5rem 0;
	}
	textarea {
		width: 100%;
	}
</style>
