<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import Modal from '../../../../../components/Modal.svelte';

	type Vote = {
		id: string;
		voter_id: string;
		vote_choice: 'yea' | 'nay' | 'abstain';
		voted_at: string;
		updated_at: string;
		last_set_by_role?: 'user' | 'admin' | 'owner';
		last_set_at?: string;
	};
	type VoteCounts = { yea: number; nay: number; abstain: number; total: number };

	let votes: Vote[] = [];
	let voteCounts: VoteCounts = { yea: 0, nay: 0, abstain: 0, total: 0 };
	let loading = true;
	let error: string | null = null;

	let showModal = false;
	let targetVoterId: string | null = null;
	let newChoice: 'yea' | 'nay' | 'abstain' | null = null;
	let reason: string = '';
	let notifyUser = true;

	let ballotId = '';

	async function fetchAdminVotes() {
		const s = $session;
		// if (!s) {
		// 	goto('/auth');
		// 	return;
		// }
		const res = await fetch(`/api/ballots/${ballotId}/votes`, {
			headers: { Authorization: `Bearer ${s.access_token}` }
		});
		if (res.status === 403) {
			goto('/auth');
			return;
		}
		const data = await res.json();
		votes = data.votes;
		voteCounts = data.vote_counts;
	}

	function openSetVote(voterId: string, current?: 'yea' | 'nay' | 'abstain') {
		targetVoterId = voterId;
		newChoice = current ?? null;
		reason = '';
		showModal = true;
	}

	async function submitOverride() {
		if (!targetVoterId || !newChoice) return;
		const s = $session;
		if (!s) {
			goto('/auth');
			return;
		}
		const res = await fetch(`/api/ballots/${ballotId}/votes/${targetVoterId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.access_token}` },
			body: JSON.stringify({ vote_choice: newChoice, reason, notify_user: notifyUser })
		});
		if (res.status === 403) {
			error = 'Forbidden';
			return;
		}
		if (!res.ok) {
			error = 'Failed to update vote';
			return;
		}
		showModal = false;
		await fetchAdminVotes();
	}

	onMount(async () => {
		// derive id from location
		const match = location.pathname.match(/\/admin\/ballots\/([^/]+)\/votes/);
		ballotId = match?.[1] || '';
		if (!ballotId) {
			goto('/ballots');
			return;
		}
		try {
			await fetchAdminVotes();
		} catch (e) {
			console.error(e);
			error = 'Failed to load votes';
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Admin Votes</title>
</svelte:head>

{#if loading}
	<p>Loading…</p>
{:else if error}
	<p class="error">{error}</p>
{:else}
	<section>
		<h1>Ballot Votes (Admin)</h1>
		<div class="counts">
			<span>Yea: {voteCounts.yea}</span>
			<span>Nay: {voteCounts.nay}</span>
			<span>Abstain: {voteCounts.abstain}</span>
			<span>Total: {voteCounts.total}</span>
		</div>
		<table>
			<thead>
				<tr>
					<th>Voter ID</th>
					<th>Current Vote</th>
					<th>Last Set By</th>
					<th>Last Set At</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each votes as v}
					<tr>
						<td>{v.voter_id}</td>
						<td>{v.vote_choice}</td>
						<td>{v.last_set_by_role ?? 'user'}</td>
						<td>{v.last_set_at ? new Date(v.last_set_at).toLocaleString() : ''}</td>
						<td>
							<button class="btn" on:click={() => openSetVote(v.voter_id, v.vote_choice)}
								>Set/Change</button
							>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</section>
{/if}

<Modal bind:open={showModal} title="Set/Change Vote" size="md" initialFocus="input[name='choice']">
	<fieldset>
		<legend>Vote Choice</legend>
		<label
			><input
				type="radio"
				name="choice"
				value="yea"
				on:change={() => (newChoice = 'yea')}
				checked={newChoice === 'yea'}
			/> Yea</label
		>
		<label
			><input
				type="radio"
				name="choice"
				value="nay"
				on:change={() => (newChoice = 'nay')}
				checked={newChoice === 'nay'}
			/> Nay</label
		>
		<label
			><input
				type="radio"
				name="choice"
				value="abstain"
				on:change={() => (newChoice = 'abstain')}
				checked={newChoice === 'abstain'}
			/> Abstain</label
		>
	</fieldset>
	<label
		>Reason (optional)
		<textarea bind:value={reason} rows="3" maxlength="500"></textarea>
	</label>
	<label><input type="checkbox" bind:checked={notifyUser} /> Notify voter by email</label>
	<div slot="footer" class="actions">
		<button class="btn" on:click={() => (showModal = false)}>Cancel</button>
		<button class="btn btn-primary" on:click={submitOverride} disabled={!newChoice}>Save</button>
	</div>
</Modal>

<style>
	.counts {
		display: flex;
		gap: 1rem;
		margin: 1rem 0;
	}
	table {
		width: 100%;
		border-collapse: collapse;
	}
	th,
	td {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		text-align: left;
	}
</style>
