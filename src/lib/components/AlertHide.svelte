<script lang="ts">
	import { Alert } from 'flowbite-svelte';
	import { fade } from 'svelte/transition';

	let {
		message,
		color,
		timeout = 3000,
		class: className
	} = $props<{
		message: string | undefined;
		color: string;
		timeout?: number;
		class?: string;
	}>();

	let visible = $state(false);
	let timeoutId: NodeJS.Timeout | undefined = undefined;

	$effect(() => {
		if (message) {
			visible = true;
		} else {
			visible = false;
		}
	});

	$effect(() => {
		if (message) {
			visible = true;
			if (timeoutId) clearTimeout(timeoutId);
			timeoutId = setTimeout(() => (visible = false), timeout);
			return () => {
				clearTimeout(timeoutId);
			};
		}
	});
</script>

{#if visible}
	<div in:fade out:fade>
		<Alert {color} class={className}>
			{message}
		</Alert>
	</div>
{/if}
