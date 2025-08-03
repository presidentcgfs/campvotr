<script lang="ts">
	import { Carta, MarkdownEditor } from 'carta-md';
	import 'carta-md/default.css'; /* Default theme */
	import DOMPurify from 'isomorphic-dompurify';
	import './carta-github.css';

	let { value = $bindable() } = $props();

	export { value };

	const carta = new Carta({
		// Remember to use a sanitizer to prevent XSS attacks!
		// More on that below
		sanitizer: DOMPurify.sanitize
	});
</script>

<MarkdownEditor {carta} mode="tabs" theme="github" bind:value />

<style>
	:global(.carta-font-code) {
		font-family: '...', monospace;
		font-size: 1.1rem;
		line-height: 1.1rem;
		letter-spacing: normal;
	}
</style>
