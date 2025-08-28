/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./index.html',
		'./index.html',
		'./src/app.html',
		'./src/**/*.{js,ts,jsx,tsx,svelte}', // Adjust this path to include your relevant files
		'**/*.svelte',
		'node_modules/flowbite/**/*.js' // Ensure Flowbite's JS files are scanned
	],
	theme: {
		extend: {}
	},
	plugins: [require('flowbite/plugin')]
};
