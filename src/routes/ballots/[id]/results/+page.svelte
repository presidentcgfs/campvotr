<script lang="ts">
	import type { PageData } from './$types';
	import { formatDateTime } from '$lib/utils/date';
	import VotingProgress from '$lib/components/VotingProgress.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import { page } from '$app/stores';

	export let data: PageData;
	const ballot = data.ballot;
	const passingStatus = data.passingStatus;
	const votes = data.votes;
	const org = data.organization as any | null;

	$: totalVotes = passingStatus?.total_votes_cast ?? 0;
	$: totalEligible = passingStatus?.total_eligible_voters ?? 0;
	$: voteCounts = passingStatus?.vote_counts ?? { yea: 0, nay: 0, abstain: 0, total: 0 };
	$: yeaPct = totalEligible > 0 ? (voteCounts.yea / totalEligible) * 100 : 0;
	$: nayPct = totalEligible > 0 ? (voteCounts.nay / totalEligible) * 100 : 0;
	$: abstainPct = totalEligible > 0 ? (voteCounts.abstain / totalEligible) * 100 : 0;

	function pct(n: number) { return n.toFixed(1) + '%'; }
</script>

<div class="container">
	<header class="header">
		<div class="org">
			{#if org?.logo_url}
				<img src={org.logo_url} alt={org.name + ' logo'} class="org-logo" />
			{/if}
			{#if org}
				<div class="org-name" style="--primary: {org.primary_color}">{org.name}</div>
			{/if}
		</div>
		<h1 class="title">{ballot.title}</h1>
		<div class="sub">
			<span><strong>Creator:</strong> {data.creator_email ?? ballot.creator_id}</span>
			<span><strong>Voting period:</strong> {formatDateTime(new Date(ballot.voting_opens_at))} — {formatDateTime(new Date(ballot.voting_closes_at))}</span>
		</div>
	</header>

	<section class="overview">
		<div class="status">
			<span class="badge {ballot.status}">{ballot.status}</span>
			{#if passingStatus}
				<span class="final {passingStatus.is_passing ? 'pass' : 'fail'}">
					{passingStatus.is_passing ? 'Passed' : 'Failed'}
				</span>
			{/if}
		</div>
		<div class="desc">
			<Markdown content={ballot.description} />
		</div>
	</section>

	{#if passingStatus}
		<section class="summary">
			<h2>Vote Summary</h2>
			<div class="cards">
				<div class="card"><div class="label">Total votes</div><div class="value">{totalVotes} / {totalEligible}</div></div>
				<div class="card"><div class="label">Yea</div><div class="value green">{voteCounts.yea} <small>({pct(yeaPct)})</small></div></div>
				<div class="card"><div class="label">Nay</div><div class="value red">{voteCounts.nay} <small>({pct(nayPct)})</small></div></div>
				<div class="card"><div class="label">Abstain</div><div class="value gray">{voteCounts.abstain} <small>({pct(abstainPct)})</small></div></div>
				{#if passingStatus.quorum_required}
					<div class="card"><div class="label">Quorum</div><div class="value">{passingStatus.quorum_met ? 'Met' : 'Not met'} <small>({passingStatus.total_votes_cast}/{passingStatus.quorum_required})</small></div></div>
				{/if}
			</div>

			<VotingProgress
				passingStatus={passingStatus}
				votingThreshold={ballot.voting_threshold}
				customThresholdPercentage={ballot.threshold_percentage ? parseFloat(ballot.threshold_percentage) : undefined}
			/>
		</section>
	{/if}

	<section class="voters">
		<h2>Individual Voter Records</h2>
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>Voter</th>
						<th>Choice</th>
						<th>Voted at</th>
					</tr>
				</thead>
				<tbody>
					{#if votes.length === 0}
						<tr><td colspan="3" class="empty">No votes have been cast.</td></tr>
					{:else}
						{#each votes as v}
							<tr>
								<td>{v.voter_name ?? v.voter_email}</td>
								<td class="choice {v.vote_choice}">{v.vote_choice.toUpperCase()}</td>
								<td>{formatDateTime(new Date(v.voted_at))}</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</section>

	<div class="actions">
		<a href="/ballots/{ballot.id}" class="btn">Back to Ballot</a>
		<a href="/ballots" class="btn secondary">All Ballots</a>
	</div>
</div>

<style>
	.container { max-width: 960px; margin: 0 auto; padding: 1rem; }
	.header { display: flex; flex-direction: column; gap: .5rem; margin-bottom: 1rem; }
	.title { margin: 0; }
	.sub { color: #555; font-size: .9rem; display: flex; gap: 1rem; flex-wrap: wrap; }
	.org { display: flex; align-items: center; gap: .75rem; }
	.org-logo { width: 32px; height: 32px; object-fit: contain; border-radius: 4px; }
	.org-name { font-weight: 600; color: var(--primary, #2563eb); }

	.overview { background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
	.status { display: flex; align-items: center; gap: .75rem; margin-bottom: .75rem; }
	.badge { padding: .25rem .5rem; border-radius: 999px; font-size: .75rem; text-transform: uppercase; background: #eee; }
	.badge.open { background: #d1fae5; color: #065f46; }
	.badge.closed { background: #fee2e2; color: #991b1b; }
	.badge.draft { background: #fef9c3; color: #854d0e; }
	.final { font-weight: 600; }
	.final.pass { color: #16a34a; }
	.final.fail { color: #dc2626; }
	.desc :global(p) { margin: .5rem 0; }

	.summary { margin-top: 1rem; }
	.cards { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: .75rem; }
	.card { background: #fff; border-radius: 8px; padding: .75rem; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
	.card .label { color: #666; font-size: .8rem; }
	.card .value { font-weight: 700; font-size: 1.1rem; }
	.card .value small { font-weight: 500; color: #666; }
	.value.green { color: #16a34a; }
	.value.red { color: #dc2626; }
	.value.gray { color: #6b7280; }

	.voters { margin-top: 1rem; }
	.table-wrap { overflow-x: auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
	table { width: 100%; border-collapse: collapse; }
	thead th { text-align: left; padding: .75rem; font-size: .85rem; color: #555; border-bottom: 1px solid #eee; }
	tbody td { padding: .75rem; border-bottom: 1px solid #f3f4f6; }
	.choice.yea { color: #16a34a; font-weight: 600; }
	.choice.nay { color: #dc2626; font-weight: 600; }
	.choice.abstain { color: #6b7280; font-weight: 600; }
	.empty { text-align: center; color: #666; }

	.actions { display: flex; gap: .5rem; margin: 1rem 0; }
	.btn { display:inline-flex; align-items:center; gap:.5rem; padding:.5rem .75rem; border-radius:6px; border:1px solid #e5e7eb; background:#fff; }
	.btn.secondary { background: #f9fafb; }

	@media (max-width: 768px) {
		.cards { grid-template-columns: repeat(2, minmax(0,1fr)); }
	}
</style>

