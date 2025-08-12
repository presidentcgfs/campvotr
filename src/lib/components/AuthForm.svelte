<script lang="ts">
	import { goto } from '$app/navigation';
	import { AuthService } from '$lib/auth';
	import Button from './Button.svelte';

	export let mode: 'signin' | 'signup' = 'signin';
	export let onLogin: () => void = () => {
		goto('/dashboard');
	};
	let email = '';
	let password = '';
	let loading = false;
	let error = '';
	let message = '';
	async function handleSubmit() {
		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		loading = true;
		error = '';

		try {
			if (mode === 'signup') {
				await AuthService.signUp(email, password);
				message = 'Account created. Please check your email to verify your account.';
				mode = 'signin';
			} else {
				await AuthService.signIn(email, password);
			}

			// Redirect to dashboard after successful auth
			onLogin();
		} catch (err: any) {
			error = err.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	async function handleGoogleSignIn() {
		loading = true;
		error = '';

		try {
			await AuthService.signInWithGoogle();
			onLogin();
			// The redirect will be handled by Supabase
		} catch (err: any) {
			error = err.message || 'Google sign-in failed';
			loading = false;
		}
	}

	function toggleMode() {
		mode = mode === 'signin' ? 'signup' : 'signin';
		error = '';
	}
</script>

<div
	class="center flex w-full max-w-xs flex-col place-content-center content-center justify-center"
>
	<!-- Google Sign-In Button -->
	<button type="button" class="google-btn" on:click={handleGoogleSignIn} disabled={loading}>
		<svg width="18" height="18" viewBox="0 0 24 24">
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
			/>
			<path
				fill="#FBBC05"
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
			/>
		</svg>
		{loading ? 'Loading...' : `Continue with Google`}
	</button>

	<div class="divider">
		<span>or</span>
	</div>
	<div>
		{#if message}
			<p class="border-l-4 border-orange-500 bg-orange-100 p-4 text-orange-700">{message}</p>
		{/if}
	</div>
	<form
		on:submit|preventDefault={handleSubmit}
		class="mb-4 rounded bg-white px-8 pb-8 pt-6 shadow-md"
	>
		<div class="mb-2 block text-gray-700">
			<label class="mb-2 block text-sm font-bold text-gray-700" for="email">Email</label>
			<input
				id="email"
				class="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
				type="email"
				bind:value={email}
				placeholder="Enter your email"
				required
			/>
		</div>

		<div class="mb-2 block text-gray-700">
			<label for="password" class="mb-2 block text-sm font-bold text-gray-700">Password</label>
			<input
				class="focus:shadow-outline w-full appearance-none rounded border px-3 py-2 leading-tight text-gray-700 shadow focus:outline-none"
				id="password"
				type="password"
				bind:value={password}
				placeholder="Enter your password"
				required
				minlength="6"
			/>
		</div>

		{#if error}
			<p class="border-l-4 border-red-500 bg-red-100 p-4 text-red-700">{error}</p>
		{/if}

		<Button type="submit" disabled={loading}>
			{loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
		</Button>
	</form>

	<p class="toggle-mode">
		{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
		<button type="button" on:click={toggleMode} class="link-button">
			{mode === 'signin' ? 'Sign Up' : 'Sign In'}
		</button>
	</p>
</div>

<style>
	.center {
		margin: 0 auto;
	}

	.google-btn {
		width: 100%;
		background: white;
		color: #333;
		border: 1px solid #dadce0;
		padding: 0.75rem 1rem;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.google-btn:hover:not(:disabled) {
		background: #f8f9fa;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.divider {
		text-align: center;
		position: relative;
	}

	.divider::before,
	.divider::after {
		content: '';
		position: absolute;
		top: 50%;
		height: 1px;
		width: calc(50% - 1rem);
		background: #ddd;
	}
	.divider::before {
		left: unset;
		right: 0;
	}
	.divider::after {
		right: unset;
		left: 0;
	}

	.error {
		color: #dc3545;
		margin-bottom: 1rem;
		padding: 0.5rem;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
	}

	.toggle-mode {
		text-align: center;
		margin-top: 1rem;
		color: #666;
	}

	.link-button {
		background: none;
		border: none;
		color: #007bff;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
		width: auto;
	}

	.link-button:hover {
		color: #0056b3;
	}
</style>
