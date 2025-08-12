<script lang="ts">
	export let variant: 'primary' | 'secondary' | 'tertiary' = 'primary';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let disabled = false;
	export let loading = false;
	export let label = '';
	export let href: string | undefined = undefined;
	$: component = href ? 'a' : 'button';
</script>

<svelte:element
	this={component}
	class="btn {$$props.class}"
	class:variant
	class:size
	class:has-icon={$$slots.icon}
	data-btn={size}
	data-btn-type={variant}
	data-disabled={disabled || loading}
	{...component === 'a' ? { href } : { disabled: disabled || loading }}
	{...$$props}
>
	{#if loading}
		<span class="sr-only">Loading...</span>
	{/if}
	<slot name="icon" />
	<slot>{label}</slot>
</svelte:element>

<style>
	.has-icon {
		gap: 0.5rem;
		display: flex;
		align-items: center;
	}
	.btn {
		@apply rounded px-4 py-2 font-bold;
		--color-secondary: var(var(--color-secondary), #64748b);
		--color-primary: var(var(--color-primary), #2563eb);
		--color-accent: var(var(--color-accent), #22c55e);
		--button-bg: var(--color-primary, #2563eb);
		background-color: var(--button-bg);
		color: var(--button-text, #ffffff);
	}
	.btn:hover {
		opacity: 0.7;
	}
	.btn:disabled,
	.btn[data-disabled] {
		@apply cursor-not-allowed rounded px-4 py-2 font-bold text-white opacity-50;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.btn[data-btn-type='primary'] {
		@apply text-white;
		--button-bg: var(--color-primary);

		&::hover {
			@apply bg-blue-700;
		}
	}

	.btn[data-btn-type='secondary'] {
		@apply rounded border bg-transparent px-4 py-2 font-semibold;
		border: 1px solid;
		border-color: var(--color-secondary);
		color: var(--color-secondary);
	}

	.btn[data-btn-type='tertiary'] {
		background-color: transparent;
		@apply border-gray-300 text-gray-700;
		color: var(--color-primary);
	}

	.btn[--data-btn-size='sm'] {
		@apply text-sm;
	}

	.btn[--data-btn-size='md'] {
		@apply text-base;
	}

	.btn[--data-brn-size='lg'] {
		@apply text-lg;
	}
</style>
