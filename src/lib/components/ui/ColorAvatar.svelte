<script lang="ts">
	import { stringToVibrantColor, stringToPastelColor, getContrastTextColor, getInitials } from '$lib/utils/color-utils';
	
	interface Props {
		name?: string;
		email?: string;
		src?: string | null;
		size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
		variant?: 'vibrant' | 'pastel' | 'gradient';
		rounded?: 'full' | 'lg' | 'md' | 'sm' | 'none';
		border?: boolean;
		class?: string;
	}

	let {
		name,
		email,
		src = null,
		size = 'md',
		variant = 'vibrant',
		rounded = 'full',
		border = false,
		class: className = ''
	}: Props = $props();

	// Size classes
	const sizeClasses = {
		xs: 'w-6 h-6 text-xs',
		sm: 'w-8 h-8 text-sm',
		md: 'w-10 h-10 text-base',
		lg: 'w-12 h-12 text-lg',
		xl: 'w-16 h-16 text-xl'
	};

	// Rounded classes
	const roundedClasses = {
		full: 'rounded-full',
		lg: 'rounded-lg',
		md: 'rounded-md',
		sm: 'rounded-sm',
		none: 'rounded-none'
	};

	// Get display name
	const displayName = $derived(name || email || 'Unknown');
	
	// Generate colors based on variant
	const backgroundColor = $derived.by(() => {
		if (variant === 'pastel') {
			return stringToPastelColor(displayName);
		}
		return stringToVibrantColor(displayName);
	});
	
	const textColor = $derived(getContrastTextColor(backgroundColor));
	const initials = $derived(getInitials(displayName));
	
	// Generate gradient if needed
	const gradientStyle = $derived.by(() => {
		if (variant === 'gradient') {
			const color1 = stringToVibrantColor(displayName);
			const color2 = stringToVibrantColor(displayName.split('').reverse().join(''));
			return `background: linear-gradient(135deg, ${color1}, ${color2})`;
		}
		return '';
	});

	// Generate avatar URL if no src provided
	const avatarUrl = $derived.by(() => {
		if (src) return src;
		
		const bgColor = backgroundColor.replace('#', '');
		const fgColor = textColor.replace('#', '');
		return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=${bgColor}&color=${fgColor}`;
	});
</script>

{#if src !== undefined && src !== null}
	<!-- Image Avatar -->
	<img
		{src}
		alt={displayName}
		class="{sizeClasses[size]} {roundedClasses[rounded]} {border ? 'ring-2 ring-white' : ''} {className}"
	/>
{:else}
	<!-- Initials Avatar -->
	<div
		class="flex items-center justify-center font-semibold {sizeClasses[size]} {roundedClasses[rounded]} {border ? 'ring-2 ring-white' : ''} {className}"
		style="{variant === 'gradient' ? gradientStyle : `background-color: ${backgroundColor}`}; color: {textColor}"
		title={displayName}
	>
		{initials}
	</div>
{/if}
