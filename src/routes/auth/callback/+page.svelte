<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';

	let loading = true;
	let error = '';

	onMount(async () => {
		try {
			// Handle the OAuth callback
			const { data, error: authError } = await supabase.auth.getSession();

			if (authError) {
				throw authError;
			}

			if (data.session) {
				// Redirect to dashboard
				goto('/dashboard');
			} else {
				// No session found, redirect to auth page
				goto('/auth');
			}
		} catch (err: any) {
			error = err.message || 'Authentication failed';
			loading = false;
		}
	});
</script>

<div class="callback-container">
	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Completing sign-in...</p>
		</div>
	{:else if error}
		<div class="error-container">
			<h2>Authentication Error</h2>
			<p>{error}</p>
			<a href="/auth" class="btn">Try Again</a>
		</div>
	{/if}
</div>

<style>
	.callback-container {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 100vh;
		padding: 2rem;
	}

	.loading {
		text-align: center;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid #f3f3f3;
		border-top: 4px solid #007bff;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin: 0 auto 1rem;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-container {
		text-align: center;
		max-width: 400px;
		padding: 2rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		background: white;
	}

	.error-container h2 {
		color: #dc3545;
		margin-bottom: 1rem;
	}

	.error-container p {
		color: #666;
		margin-bottom: 2rem;
	}

	.btn {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: #007bff;
		color: white;
		text-decoration: none;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	.btn:hover {
		background: #0056b3;
	}
</style>
