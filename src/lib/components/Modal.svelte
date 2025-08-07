<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fade, scale } from 'svelte/transition';

	export let open = false;
	export let title: string | undefined = undefined;
	export let role: 'dialog' | 'alertdialog' = 'dialog';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let closeOnEsc = true;
	export let closeOnOutsideClick = true;
	export let preventScroll = true;
	export let initialFocus: string | null = null;
	export let ariaLabel: string | undefined = undefined;

	let modalEl: HTMLDivElement | null = null;
	let headerId = `modal-header-${Math.random().toString(36).slice(2)}`;
	let lastFocused: Element | null = null;

	function closeModal() {
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;

		if (e.key === 'Escape' && closeOnEsc) {
			e.stopPropagation();
			e.preventDefault();
			closeModal();
		}

		if (e.key === 'Tab') {
			const focusable = modalEl
				? Array.from(
						modalEl.querySelectorAll<HTMLElement>(
							'a[href], button, textarea, input, select, details,[tabindex]:not([tabindex="-1"])'
						)
					).filter(
						(el) =>
							!el.hasAttribute('disabled') &&
							el.tabIndex !== -1 &&
							!el.closest('[aria-hidden="true"]')
					)
				: [];

			if (focusable.length === 0) return;
			const first = focusable[0];
			const last = focusable[focusable.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	async function onOpen() {
		if (preventScroll && typeof document !== 'undefined') {
			document.body.style.overflow = 'hidden';
		}
		await tick();

		let target: HTMLElement | null = null;
		if (initialFocus && modalEl) {
			target = modalEl.querySelector(initialFocus) as HTMLElement | null;
		}
		if (!target && modalEl) {
			target = modalEl.querySelector<HTMLElement>('[data-autofocus]') || modalEl;
		}
		target?.focus();
	}

	function onClose() {
		if (preventScroll && typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
		(lastFocused as HTMLElement | null)?.focus?.();
	}

	$: if (open) {
		lastFocused = typeof document !== 'undefined' ? document.activeElement : null;
		onOpen();
	} else {
		onClose();
	}

	onMount(() => {
		const listener = (e: KeyboardEvent) => handleKeydown(e);
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', listener, true);
		}
		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('keydown', listener, true);
			}
		};
	});

	onDestroy(() => {
		if (preventScroll && typeof document !== 'undefined') {
			document.body.style.overflow = '';
		}
	});

	function handleBackdropClick() {
		if (!closeOnOutsideClick) return;
		closeModal();
	}
</script>

{#if open}
	<div class="modal-root" aria-hidden="false">
		<div
			class="modal-backdrop"
			role="button"
			tabindex="0"
			aria-label="Close modal"
			on:click={handleBackdropClick}
			on:keydown={(e) => {
				if (!closeOnOutsideClick) return;
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					closeModal();
				}
			}}
			transition:fade
		></div>

		<div
			class="modal-panel"
			class:modal_sm={size === 'sm'}
			class:modal_md={size === 'md'}
			class:modal_lg={size === 'lg'}
			bind:this={modalEl}
			{role}
			aria-modal="true"
			aria-labelledby={title ? headerId : undefined}
			aria-label={!title && ariaLabel ? ariaLabel : undefined}
			tabindex="-1"
			transition:scale={{ duration: 120 }}
			on:click|stopPropagation
		>
			<div class="modal-header">
				<slot name="header">
					{#if title}
						<h2 id={headerId} class="modal-title">{title}</h2>
					{/if}
				</slot>
				<button class="modal-close" aria-label="Close modal" on:click={closeModal}> ✕ </button>
			</div>

			<div class="modal-body">
				<slot />
			</div>

			<div class="modal-footer">
				<slot name="footer" />
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-root {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.modal-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
	}
	.modal-panel {
		position: relative;
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 10px 15px rgba(0, 0, 0, 0.2);
		width: 100%;
		max-height: 85vh;
		overflow: auto;
		outline: none;
	}
	.modal_sm {
		max-width: 28rem;
	}
	.modal_md {
		max-width: 36rem;
	}
	.modal_lg {
		max-width: 48rem;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid #e5e7eb;
	}
	.modal-title {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0;
	}
	.modal-close {
		margin-left: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.375rem;
		padding: 0.35rem 0.5rem;
		color: #4b5563; /* gray-600 */
		background: transparent;
	}
	.modal-close:hover {
		background: #f3f4f6;
	}

	.modal-body {
		padding: 1rem;
	}
	.modal-footer {
		padding: 1rem;
		border-top: 1px solid #e5e7eb;
	}
</style>
