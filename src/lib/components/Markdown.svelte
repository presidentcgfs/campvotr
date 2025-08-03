<script lang="ts">
	import SvelteMarkdown from 'svelte-marked';

	export let content: string = '';
	let clazz: string = '';
	export { clazz as class };
</script>

<SvelteMarkdown source={content} />

<style>
	:global(.markdown-content) {
		line-height: 1.6;
	}

	:global(.markdown-content > *:first-child) {
		margin-top: 0;
	}

	:global(.markdown-content > *:last-child) {
		margin-bottom: 0;
	}

	/* Ensure proper spacing between elements */
	:global(.markdown-content h1 + p),
	:global(.markdown-content h2 + p),
	:global(.markdown-content h3 + p),
	:global(.markdown-content h4 + p),
	:global(.markdown-content h5 + p),
	:global(.markdown-content h6 + p) {
		margin-top: 0;
	}
</style>
