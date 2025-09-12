<script lang="ts">
	import ColorDemo from '$lib/components/demo/ColorDemo.svelte';
	import ColorAvatar from '$lib/components/ui/ColorAvatar.svelte';
	import { 
		stringToColor,
		stringToPastelColor,
		stringToVibrantColor,
		stringToPaletteColor,
		stringToTailwindBg,
		getInitials
	} from '$lib/utils/color-utils';

	// Sample data
	const teamMembers = [
		{ name: 'Alice Johnson', email: 'alice@example.com', role: 'Manager' },
		{ name: 'Bob Smith', email: 'bob@example.com', role: 'Developer' },
		{ name: 'Charlie Brown', email: 'charlie@example.com', role: 'Designer' },
		{ name: 'Diana Prince', email: 'diana@example.com', role: 'Product Owner' },
		{ name: 'Edward Norton', email: 'edward@example.com', role: 'QA Engineer' },
		{ name: 'Fiona Apple', email: 'fiona@example.com', role: 'DevOps' }
	];

	const categories = [
		'Sports', 'Technology', 'Music', 'Art', 'Science', 
		'History', 'Literature', 'Travel', 'Food', 'Fashion'
	];

	const statuses = [
		{ label: 'Active', count: 42 },
		{ label: 'Pending', count: 18 },
		{ label: 'Completed', count: 127 },
		{ label: 'Archived', count: 63 },
		{ label: 'Draft', count: 9 }
	];
</script>

<div class="container mx-auto p-6">
	<h1 class="text-3xl font-bold mb-8">Color Utilities Demo</h1>

	<!-- Interactive Demo -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Interactive Color Generator</h2>
		<ColorDemo />
	</section>

	<!-- Team Members with Avatars -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Team Members</h2>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each teamMembers as member}
				<div class="flex items-center space-x-3 p-4 border rounded-lg hover:shadow-md transition-shadow">
					<ColorAvatar 
						name={member.name} 
						email={member.email}
						size="lg"
						variant="vibrant"
					/>
					<div class="flex-1">
						<div class="font-semibold">{member.name}</div>
						<div class="text-sm text-gray-600">{member.role}</div>
						<div class="text-xs text-gray-500">{member.email}</div>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- Avatar Variants -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Avatar Variants</h2>
		<div class="space-y-4">
			<!-- Sizes -->
			<div>
				<h3 class="font-medium mb-2">Sizes</h3>
				<div class="flex items-center space-x-4">
					<ColorAvatar name="John Doe" size="xs" />
					<ColorAvatar name="John Doe" size="sm" />
					<ColorAvatar name="John Doe" size="md" />
					<ColorAvatar name="John Doe" size="lg" />
					<ColorAvatar name="John Doe" size="xl" />
				</div>
			</div>

			<!-- Variants -->
			<div>
				<h3 class="font-medium mb-2">Color Variants</h3>
				<div class="flex items-center space-x-4">
					<ColorAvatar name="Jane Smith" variant="vibrant" size="lg" />
					<ColorAvatar name="Jane Smith" variant="pastel" size="lg" />
					<ColorAvatar name="Jane Smith" variant="gradient" size="lg" />
				</div>
			</div>

			<!-- Shapes -->
			<div>
				<h3 class="font-medium mb-2">Shapes</h3>
				<div class="flex items-center space-x-4">
					<ColorAvatar name="User One" rounded="full" size="lg" />
					<ColorAvatar name="User One" rounded="lg" size="lg" />
					<ColorAvatar name="User One" rounded="md" size="lg" />
					<ColorAvatar name="User One" rounded="sm" size="lg" />
					<ColorAvatar name="User One" rounded="none" size="lg" />
				</div>
			</div>
		</div>
	</section>

	<!-- Category Tags -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Category Tags</h2>
		<div class="flex flex-wrap gap-2">
			{#each categories as category}
				{@const bgColor = stringToPastelColor(category)}
				{@const textColor = stringToVibrantColor(category)}
				<span 
					class="px-3 py-1 rounded-full text-sm font-medium"
					style="background-color: {bgColor}; color: {textColor}"
				>
					{category}
				</span>
			{/each}
		</div>
	</section>

	<!-- Status Cards -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Status Cards</h2>
		<div class="grid grid-cols-2 md:grid-cols-5 gap-4">
			{#each statuses as status}
				{@const bgColor = stringToColor(status.label)}
				{@const borderColor = stringToVibrantColor(status.label)}
				<div 
					class="p-4 rounded-lg border-2"
					style="border-color: {borderColor}; background-color: {bgColor}20"
				>
					<div class="text-2xl font-bold" style="color: {borderColor}">
						{status.count}
					</div>
					<div class="text-sm" style="color: {borderColor}">
						{status.label}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<!-- User List with Consistent Colors -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Consistent User Colors</h2>
		<p class="text-gray-600 mb-4">
			Each user always gets the same color based on their identifier:
		</p>
		<div class="space-y-2">
			{#each ['user123', 'admin@site.com', 'john.doe', 'support_team'] as userId}
				{@const color = stringToVibrantColor(userId)}
				{@const initials = getInitials(userId)}
				<div class="flex items-center space-x-3">
					<div 
						class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
						style="background-color: {color}"
					>
						{initials}
					</div>
					<code class="text-sm">{userId}</code>
					<span class="text-xs text-gray-500">→</span>
					<span 
						class="px-2 py-1 rounded text-xs font-mono"
						style="background-color: {color}; color: white"
					>
						{color}
					</span>
				</div>
			{/each}
		</div>
	</section>

	<!-- Color Palette Grid -->
	<section class="mb-12">
		<h2 class="text-2xl font-semibold mb-4">Generated Color Palette</h2>
		<div class="grid grid-cols-4 md:grid-cols-8 gap-2">
			{#each Array(32) as _, i}
				{@const str = `item-${i}`}
				{@const color = stringToPaletteColor(str)}
				<div 
					class="aspect-square rounded-lg flex items-center justify-center text-white font-bold"
					style="background-color: {color}"
					title={str}
				>
					{i + 1}
				</div>
			{/each}
		</div>
	</section>
</div>
