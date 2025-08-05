import svelte from 'eslint-plugin-svelte';
import tailwind from 'eslint-plugin-tailwindcss';

export default [
	// Ignore build artifacts
	{
		ignores: ['node_modules', 'build', 'dist', '.svelte-kit']
	},
	// Svelte + Tailwind rules
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte', '**/*.{js,ts}'],
		plugins: { tailwindcss: tailwind },
		rules: {
			// Enable Tailwind best practices and contradiction detection
			'tailwindcss/no-contradicting-classname': 'error'
		}
	}
];
