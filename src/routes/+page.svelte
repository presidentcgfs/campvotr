<script lang="ts">
	import { page } from '$app/state';
	import { Button, Card } from 'flowbite-svelte';
</script>

<div class="container">
	<div class="hero">
		<h1>Welcome to CampVotr</h1>
		<p class="hero-subtitle">
			A transparent, democratic voting platform for making collective decisions
		</p>

		{#if page.data.user}
			<div class="hero-actions">
				<Button href="/dashboard" color="blue" size="lg">Go to Dashboard</Button>
				<Button href="/ballots" color="alternative" size="lg">View Ballots</Button>
			</div>
		{:else}
			<div class="hero-actions">
				<Button href="/auth" color="blue" size="lg">Get Started</Button>
			</div>
		{/if}
	</div>

	<div class="features">
		<h2>Features</h2>
		<div class="grid-2 grid">
			<Card>
				<h3>🗳️ Democratic Voting</h3>
				<p>
					Create voting ballots with configurable time periods. Support for Yea, Nay, and Abstain
					votes.
				</p>
			</Card>
			<Card>
				<h3>📊 Real-time Results</h3>
				<p>Watch vote counts update in real-time as participants cast their votes.</p>
			</Card>
			<Card>
				<h3>🔍 Full Transparency</h3>
				<p>Complete voting history with timestamps showing who voted when and how.</p>
			</Card>
			<Card>
				<h3>🔔 Smart Notifications</h3>
				<p>Get notified about new ballots, voting reminders, and when voting periods close.</p>
			</Card>
		</div>
	</div>
</div>

<style>
	.hero {
		text-align: center;
		padding: 4rem 0;
		margin-bottom: 4rem;
	}

	.hero h1 {
		font-size: 3rem;
		margin-bottom: 1rem;
		color: #007bff;
	}

	.hero-subtitle {
		font-size: 1.25rem;
		color: #666;
		margin-bottom: 2rem;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.hero-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.features h2 {
		text-align: center;
		margin-bottom: 2rem;
		color: #333;
	}

	.features h3 {
		color: #007bff;
		margin-bottom: 1rem;
	}

	@media (max-width: 768px) {
		.hero h1 {
			font-size: 2rem;
		}

		.hero-subtitle {
			font-size: 1.1rem;
		}

		.hero-actions {
			flex-direction: column;
			align-items: center;
		}
	}
</style>
