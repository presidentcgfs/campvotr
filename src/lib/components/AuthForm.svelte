<script lang="ts">
	import { goto } from '$app/navigation';
	import { AuthService } from '$lib/auth';

	export let mode: 'signin' | 'signup' = 'signin';
	export let onLogin: () => void = () => {
		goto('/dashboard');
	};
	let email = '';
	let password = '';
	let loading = false;
	let error = '';

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

<div class="auth-form">
	<h2>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</h2>

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

	<form on:submit|preventDefault={handleSubmit}>
		<div class="form-group">
			<label for="email">Email</label>
			<input id="email" type="email" bind:value={email} placeholder="Enter your email" required />
		</div>

		<div class="form-group">
			<label for="password">Password</label>
			<input
				id="password"
				type="password"
				bind:value={password}
				placeholder="Enter your password"
				required
				minlength="6"
			/>
		</div>

		{#if error}
			<div class="error">{error}</div>
		{/if}

		<button type="submit" disabled={loading}>
			{loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
		</button>
	</form>

	<p class="toggle-mode">
		{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
		<button type="button" on:click={toggleMode} class="link-button">
			{mode === 'signin' ? 'Sign Up' : 'Sign In'}
		</button>
	</p>
</div>

<style>
	.auth-form {
		max-width: 400px;
		margin: 2rem auto;
		padding: 2rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		background: white;
	}

	h2 {
		text-align: center;
		margin-bottom: 1.5rem;
		color: #333;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #555;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 1rem;
	}

	input:focus {
		outline: none;
		border-color: #007bff;
		box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
	}

	button {
		width: 100%;
		padding: 0.75rem;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	button:hover:not(:disabled) {
		background: #0056b3;
	}

	button:disabled {
		background: #6c757d;
		cursor: not-allowed;
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
		margin: 1.5rem 0;
		position: relative;
	}

	.divider::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 0;
		right: 0;
		height: 1px;
		background: #ddd;
	}

	.divider span {
		background: white;
		padding: 0 1rem;
		color: #666;
		font-size: 0.9rem;
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
