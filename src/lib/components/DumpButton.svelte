<script lang="ts">
	import { Button } from 'flowbite-svelte';
	let { value } = $props();
	function handleDump() {
		console.log('dump');
		console.dir(value, { depth: 20 });
	}
</script>

<Button outline pill onclick={handleDump} />
