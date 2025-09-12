<script lang="ts">
	import { 
		stringToColor, 
		stringToPastelColor, 
		stringToVibrantColor,
		stringToPaletteColor,
		getContrastTextColor,
		getInitials,
		stringToGradient
	} from '$lib/utils/color-utils';

	let inputText = $state('John Doe');
	
	// Computed colors
	const standardColor = $derived(stringToColor(inputText));
	const pastelColor = $derived(stringToPastelColor(inputText));
	const vibrantColor = $derived(stringToVibrantColor(inputText));
	const paletteColor = $derived(stringToPaletteColor(inputText));
	const gradient = $derived(stringToGradient(inputText));
	const initials = $derived(getInitials(inputText));
	
	// Sample names for demonstration
	const sampleNames = [
		'Alice Johnson',
		'Bob Smith',
		'Charlie Brown',
		'Diana Prince',
		'Edward Norton',
		'Fiona Apple',
		'George Washington',
		'Helen Troy',
		'user@example.com',
		'john.doe@company.org'
	];
</script>

<div class="p-6 space-y-6">
	<div class="max-w-4xl mx-auto">
		<h2 class="text-2xl font-bold mb-4">Color Generation Demo</h2>
		
		<!-- Input -->
		<div class="mb-6">
			<label for="textInput" class="block text-sm font-medium mb-2">
				Enter text to generate colors:
			</label>
			<input
				id="textInput"
				type="text"
				bind:value={inputText}
				class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
				placeholder="Enter any text..."
			/>
		</div>

		<!-- Color Results -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
			<!-- Standard Color -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">Standard Color</h3>
				<div 
					class="h-24 rounded flex items-center justify-center text-lg font-bold"
					style="background-color: {standardColor}; color: {getContrastTextColor(standardColor)}"
				>
					{standardColor}
				</div>
			</div>

			<!-- Pastel Color -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">Pastel Color</h3>
				<div 
					class="h-24 rounded flex items-center justify-center text-lg font-bold"
					style="background-color: {pastelColor}; color: {getContrastTextColor(pastelColor)}"
				>
					{pastelColor}
				</div>
			</div>

			<!-- Vibrant Color -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">Vibrant Color</h3>
				<div 
					class="h-24 rounded flex items-center justify-center text-lg font-bold"
					style="background-color: {vibrantColor}; color: {getContrastTextColor(vibrantColor)}"
				>
					{vibrantColor}
				</div>
			</div>

			<!-- Palette Color -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">Palette Color</h3>
				<div 
					class="h-24 rounded flex items-center justify-center text-lg font-bold"
					style="background-color: {paletteColor}; color: {getContrastTextColor(paletteColor)}"
				>
					{paletteColor}
				</div>
			</div>

			<!-- Gradient -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">Gradient</h3>
				<div 
					class="h-24 rounded flex items-center justify-center text-lg font-bold text-white"
					style="background: {gradient}"
				>
					Gradient
				</div>
			</div>

			<!-- Avatar with Initials -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">Avatar</h3>
				<div class="flex items-center justify-center">
					<div 
						class="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold"
						style="background-color: {vibrantColor}; color: {getContrastTextColor(vibrantColor)}"
					>
						{initials}
					</div>
				</div>
			</div>
		</div>

		<!-- Sample Names Grid -->
		<div class="border rounded-lg p-4">
			<h3 class="font-semibold mb-4">Sample Names with Generated Colors</h3>
			<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
				{#each sampleNames as name}
					{@const bgColor = stringToVibrantColor(name)}
					{@const textColor = getContrastTextColor(bgColor)}
					{@const nameInitials = getInitials(name)}
					<div class="flex flex-col items-center space-y-2">
						<div 
							class="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold"
							style="background-color: {bgColor}; color: {textColor}"
							title={name}
						>
							{nameInitials}
						</div>
						<span class="text-xs text-center truncate w-full px-1">
							{name}
						</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- Color Consistency Demo -->
		<div class="border rounded-lg p-4 mt-4">
			<h3 class="font-semibold mb-4">Color Consistency</h3>
			<p class="text-sm text-gray-600 mb-4">
				The same string always generates the same color:
			</p>
			<div class="space-y-2">
				{#each ['Test String', 'Test String', 'Different String', 'Test String'] as str, i}
					{@const color = stringToColor(str)}
					<div class="flex items-center space-x-3">
						<div 
							class="w-8 h-8 rounded"
							style="background-color: {color}"
						></div>
						<span class="text-sm font-mono">{str}</span>
						<span class="text-xs text-gray-500">{color}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
