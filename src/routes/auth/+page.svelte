<script>
	import AuthForm from '$lib/components/AuthForm.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	onMount(() => {
		// Redirect if already authenticated
		if ($page.data.user) {
			goto('/dashboard');
		}
	});
</script>

<div class="container">
	<AuthForm />
</div>
