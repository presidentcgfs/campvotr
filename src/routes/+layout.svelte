<script>
	import '../app.css';
	import Navigation from '$lib/components/Navigation.svelte';
</script>

<Navigation />

<main>
	<slot />
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: #f8f9fa;
		color: #333;
		line-height: 1.6;
	}

	:global(*) {
		box-sizing: border-box;
	}

	main {
		min-height: calc(100vh - 60px);
		padding: 2rem 1rem;
	}

	:global(.container) {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 1rem;
	}

	:global(.card) {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		margin-bottom: 1rem;
	}

	:global(.btn) {
		display: inline-block;
		padding: 0.75rem 1.5rem;
		background: #007bff;
		color: white;
		text-decoration: none;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		transition: background-color 0.2s;
	}

	:global(.btn:hover) {
		background: #0056b3;
	}

	:global(.btn-secondary) {
		background: #6c757d;
	}

	:global(.btn-secondary:hover) {
		background: #545b62;
	}

	:global(.btn-success) {
		background: #28a745;
	}

	:global(.btn-success:hover) {
		background: #1e7e34;
	}

	:global(.btn-danger) {
		background: #dc3545;
	}

	:global(.btn-danger:hover) {
		background: #c82333;
	}

	:global(.btn-sm) {
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
	}

	:global(.text-center) {
		text-align: center;
	}

	:global(.mb-1) { margin-bottom: 0.5rem; }
	:global(.mb-2) { margin-bottom: 1rem; }
	:global(.mb-3) { margin-bottom: 1.5rem; }
	:global(.mt-1) { margin-top: 0.5rem; }
	:global(.mt-2) { margin-top: 1rem; }
	:global(.mt-3) { margin-top: 1.5rem; }

	:global(.grid) {
		display: grid;
		gap: 1rem;
	}

	:global(.grid-2) {
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
	}

	:global(.flex) {
		display: flex;
		gap: 1rem;
	}

	:global(.flex-between) {
		justify-content: space-between;
		align-items: center;
	}

	:global(.flex-center) {
		justify-content: center;
		align-items: center;
	}

	:global(.loading) {
		text-align: center;
		padding: 2rem;
		color: #666;
	}

	:global(.error) {
		color: #dc3545;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		padding: 1rem;
		margin: 1rem 0;
	}

	:global(.success) {
		color: #155724;
		background: #d4edda;
		border: 1px solid #c3e6cb;
		border-radius: 4px;
		padding: 1rem;
		margin: 1rem 0;
	}
</style>
