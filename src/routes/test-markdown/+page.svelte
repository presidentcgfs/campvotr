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

<div class="container mx-auto p-8 max-w-4xl">
	<h1 class="text-3xl font-bold mb-6">Markdown Test Page</h1>
	
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<div>
			<h2 class="text-xl font-semibold mb-4">Raw Markdown</h2>
			<pre class="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">{testMarkdown}</pre>
		</div>
		
		<div>
			<h2 class="text-xl font-semibold mb-4">Rendered Output</h2>
			<div class="bg-white border border-gray-200 p-4 rounded">
				<Markdown content={testMarkdown} />
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		font-family: system-ui, -apple-system, sans-serif;
	}
</style>
