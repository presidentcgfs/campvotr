<script lang="ts">
	import Markdown from '$lib/components/Markdown.svelte';

	const testMarkdown = `# Test Markdown

This is a **bold** text and this is *italic* text.

## Lists

### Unordered List
- Item 1
- Item 2
- Item 3

### Ordered List
1. First item
2. Second item
3. Third item

## Links and Code

Here's a [link to Google](https://google.com).

Here's some inline \`code\` and a code block:

\`\`\`javascript
function hello() {
    console.log("Hello, world!");
}
\`\`\`

## Blockquote

> This is a blockquote
> with multiple lines

## Mixed Content

You can combine **bold** and *italic* text, add [links](https://example.com), and include \`inline code\` all in one paragraph.`;
</script>

<div class="container mx-auto max-w-4xl p-8">
	<h1 class="mb-6 text-3xl font-bold">Markdown Test Page</h1>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<div>
			<h2 class="mb-4 text-xl font-semibold">Raw Markdown</h2>
			<pre
				class="overflow-x-auto whitespace-pre-wrap rounded bg-gray-100 p-4 text-sm">{testMarkdown}</pre>
		</div>

		<div>
			<h2 class="mb-4 text-xl font-semibold">Rendered Output</h2>
			<div class="rounded border border-gray-200 bg-white p-4">
				<Markdown content={testMarkdown} />
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}
</style>
