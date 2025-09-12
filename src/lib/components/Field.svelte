<script lang="ts">
	import { Alert, Input, Select } from 'flowbite-svelte';
	import type { Snippet } from 'svelte';
	let { errors = [] } = $props<{ errors: string[]; 
    path: string;
    label: Snippet;
    input:Snippet;
     }>();
</script>

<div>
	<label for="rounds" class="block text-sm font-medium text-gray-700"
		>{#snippet label()}{/snippet}</label
	>
	{#if errors.length}
		<Alert color="red">{errors.length == 1? errors[0] : errors.join(', ')]}</Alert>
	{/if}
	{#snippet  input()}
        
    {/snippet}
</div>
