<script lang="ts">
	import { goto } from '$app/navigation';
	import { AuthService } from '$lib/auth';
	import { Button, Input, Alert, Card } from 'flowbite-svelte';

	interface Props {
		mode?: 'signin' | 'signup';
		onLogin?: () => void;
	}

	let { mode = $bindable('signin'), onLogin = () => goto('/dashboard') }: Props = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');
	let message = $state('');
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
	<Button
		type="button"
		class="google-btn w-full"
		color="alternative"
		onclick={handleGoogleSignIn}
		disabled={loading}
	>
		<svg width="18" height="18" viewBox="0 0 24 24" class="mr-2">
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
	</Button>

	<div class="divider">
		<span>or</span>
	</div>
	{#if message}
		<Alert color="yellow" class="mb-4">
			{message}
		</Alert>
	{/if}

	<Card class="mb-4">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<div class="mb-4">
				<label for="email" class="mb-2 block text-sm font-medium text-gray-900">Email</label>
				<Input id="email" type="email" bind:value={email} placeholder="Enter your email" required />
			</div>

			<div class="mb-4">
				<label for="password" class="mb-2 block text-sm font-medium text-gray-900">Password</label>
				<Input
					id="password"
					type="password"
					bind:value={password}
					placeholder="Enter your password"
					required
					minlength={6}
				/>
			</div>

			{#if error}
				<Alert color="red" class="mb-4">
					{error}
				</Alert>
			{/if}

			<Button type="submit" disabled={loading} class="w-full">
				{loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
			</Button>
		</form>
	</Card>

	<p class="toggle-mode">
		{mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
		<Button
			type="button"
			onclick={toggleMode}
			color="alternative"
			class="link-button p-0 text-blue-600 underline"
		>
			{mode === 'signin' ? 'Sign Up' : 'Sign In'}
		</Button>
	</p>
</div>

<style>
	.center {
		margin: 0 auto;
	}

	.divider {
		text-align: center;
		position: relative;
		margin: 1rem 0;
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

	.toggle-mode {
		text-align: center;
		margin-top: 1rem;
		color: #666;
	}
</style>
