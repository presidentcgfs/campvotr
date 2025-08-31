<script lang="ts" generics="T">
	import { groupItems, type GroupConfig, type GroupNode } from './grouper';
	import type { Snippet } from 'svelte';

	interface Props {
		items: T[];
		groups: GroupConfig<T>[];
		activeGroupKey?: string | null;
		emptyState?: string;
		header?: Snippet<
			[
				{
					config: GroupConfig<T>;
					value: string;
					depth: number;
					itemCount: number;
					path: Array<{ key: string; value: string }>;
				}
			]
		>;
		item?: Snippet<
			[{ item: T; depth: number; path: Array<{ key: string; value: string }>; index: number }]
		>;
		empty?: Snippet<[{ message: string }]>;
	}

	let {
		items,
		groups,
		activeGroupKey = null,
		emptyState = 'No items',
		header,
		item,
		empty
	}: Props = $props();

	// Memoized grouping computation using $derived for performance
	const groupTree = $derived(groupItems(items, groups, activeGroupKey));
	const hasGroups = $derived(groupTree.size > 0);
	const totalItems = $derived(
		Array.from(groupTree.values()).reduce((sum, group) => sum + group.items.length, 0)
	);
</script>

{#if !hasGroups || totalItems === 0}
	<!-- Empty state -->
	{#if empty}
		{@render empty({ message: emptyState })}
	{:else}
		<div class="py-8 text-center text-gray-500">
			{emptyState}
		</div>
	{/if}
{:else}
	<!-- Render group tree -->
	{#each Array.from(groupTree.entries()) as [groupValue, groupNode] (groupValue)}
		{@render groupNodeTemplate(groupNode)}
	{/each}
{/if}

{#snippet groupNodeTemplate(node: GroupNode<T>)}
	<!-- Group header -->
	{#if header}
		{@render header({
			config: node.config,
			value: node.value,
			depth: node.depth,
			itemCount: node.items.length,
			path: node.path
		})}
	{:else}
		<!-- Default group header -->
		{@const Component = node.config.component || 'div'}
		{#if typeof Component === 'string'}
			<svelte:element this={Component} class="mb-3" role="heading" aria-level={node.depth + 2}>
				<div class="font-semibold text-gray-900" style="margin-left: {node.depth * 0.5}rem">
					{node.config.label || node.config.key}: {node.value}
					<span class="ml-2 text-sm font-normal text-gray-500">({node.items.length} items)</span>
				</div>
			</svelte:element>
		{:else}
			<!-- For custom components, render as div with data attributes -->
			<div
				class="mb-3"
				role="heading"
				aria-level={node.depth + 2}
				data-component={node.config.component}
				data-config={JSON.stringify(node.config)}
				data-value={node.value}
				data-depth={node.depth}
			>
				<div class="font-semibold text-gray-900" style="margin-left: {node.depth * 0.5}rem">
					{node.config.label || node.config.key}: {node.value}
					<span class="ml-2 text-sm font-normal text-gray-500">({node.items.length} items)</span>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Group content -->
	<div class="ml-4">
		{#if node.children.size > 0}
			<!-- Render child groups -->
			{#each Array.from(node.children.entries()) as [childValue, childNode] (childValue)}
				{@render groupNodeTemplate(childNode)}
			{/each}
		{:else}
			<!-- Render leaf items -->
			{#each node.items as nodeItem, index (index)}
				{#if item}
					{@render item({
						item: nodeItem,
						depth: node.depth + 1,
						path: node.path,
						index: index
					})}
				{:else}
					<!-- Default item rendering -->
					<div class="mb-2 rounded border p-2" style="margin-left: {(node.depth + 1) * 0.5}rem">
						<div class="mb-1 text-xs text-gray-400">Item #{index + 1}</div>
						{JSON.stringify(nodeItem)}
					</div>
				{/if}
			{/each}
		{/if}
	</div>
{/snippet}
