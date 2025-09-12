/**
 * Color utility functions for generating consistent colors from strings
 */

/**
 * Generates a consistent color from a string using a hash function
 * @param str - The input string to generate a color from
 * @returns A hex color string (e.g., '#4A90E2')
 */
export function stringToColor(str: string): string {
	if (!str) return '#6B7280'; // Default gray color
	
	// Simple hash function
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
		hash = hash & hash; // Convert to 32-bit integer
	}
	
	// Convert hash to hex color
	const hue = Math.abs(hash % 360);
	const saturation = 65 + (Math.abs(hash >> 8) % 20); // 65-85%
	const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%
	
	return hslToHex(hue, saturation, lightness);
}

/**
 * Generates a pastel color from a string
 * @param str - The input string to generate a color from
 * @returns A hex color string with pastel tones
 */
export function stringToPastelColor(str: string): string {
	if (!str) return '#E5E7EB'; // Default light gray
	
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
		hash = hash & hash;
	}
	
	const hue = Math.abs(hash % 360);
	const saturation = 25 + (Math.abs(hash >> 8) % 30); // 25-55% for pastel
	const lightness = 75 + (Math.abs(hash >> 16) % 15); // 75-90% for light colors
	
	return hslToHex(hue, saturation, lightness);
}

/**
 * Generates a vibrant color from a string
 * @param str - The input string to generate a color from
 * @returns A hex color string with vibrant tones
 */
export function stringToVibrantColor(str: string): string {
	if (!str) return '#3B82F6'; // Default blue
	
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
		hash = hash & hash;
	}
	
	const hue = Math.abs(hash % 360);
	const saturation = 70 + (Math.abs(hash >> 8) % 30); // 70-100% for vibrant
	const lightness = 45 + (Math.abs(hash >> 16) % 10); // 45-55% for rich colors
	
	return hslToHex(hue, saturation, lightness);
}

/**
 * Generates a color from a predefined palette based on string
 * @param str - The input string to generate a color from
 * @param palette - Optional custom palette of colors
 * @returns A hex color string from the palette
 */
export function stringToPaletteColor(str: string, palette?: string[]): string {
	const defaultPalette = [
		'#EF4444', // red
		'#F97316', // orange
		'#F59E0B', // amber
		'#EAB308', // yellow
		'#84CC16', // lime
		'#22C55E', // green
		'#10B981', // emerald
		'#14B8A6', // teal
		'#06B6D4', // cyan
		'#0EA5E9', // sky
		'#3B82F6', // blue
		'#6366F1', // indigo
		'#8B5CF6', // violet
		'#A855F7', // purple
		'#D946EF', // fuchsia
		'#EC4899', // pink
		'#F43F5E'  // rose
	];
	
	const colors = palette || defaultPalette;
	
	if (!str) return colors[0];
	
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
		hash = Math.abs(hash);
	}
	
	return colors[hash % colors.length];
}

/**
 * Generates a Tailwind CSS background class from a string
 * @param str - The input string to generate a color from
 * @param intensity - Color intensity (50-900)
 * @returns A Tailwind background class (e.g., 'bg-blue-500')
 */
export function stringToTailwindBg(str: string, intensity: number = 500): string {
	const colors = [
		'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
		'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple',
		'fuchsia', 'pink', 'rose'
	];
	
	if (!str) return `bg-gray-${intensity}`;
	
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
		hash = Math.abs(hash);
	}
	
	const color = colors[hash % colors.length];
	return `bg-${color}-${intensity}`;
}

/**
 * Generates a Tailwind CSS text class from a string
 * @param str - The input string to generate a color from
 * @param intensity - Color intensity (50-900)
 * @returns A Tailwind text class (e.g., 'text-blue-500')
 */
export function stringToTailwindText(str: string, intensity: number = 700): string {
	const colors = [
		'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald',
		'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple',
		'fuchsia', 'pink', 'rose'
	];
	
	if (!str) return `text-gray-${intensity}`;
	
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
		hash = Math.abs(hash);
	}
	
	const color = colors[hash % colors.length];
	return `text-${color}-${intensity}`;
}

/**
 * Generates contrasting text color (black or white) based on background
 * @param bgColor - Background color in hex format
 * @returns '#000000' or '#FFFFFF' for optimal contrast
 */
export function getContrastTextColor(bgColor: string): string {
	// Remove # if present
	const hex = bgColor.replace('#', '');
	
	// Convert to RGB
	const r = parseInt(hex.substr(0, 2), 16);
	const g = parseInt(hex.substr(2, 2), 16);
	const b = parseInt(hex.substr(4, 2), 16);
	
	// Calculate luminance
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	
	// Return black for light backgrounds, white for dark
	return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Converts HSL values to hex color
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns Hex color string
 */
function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;
	
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	
	let r = 0, g = 0, b = 0;
	
	if (h >= 0 && h < 60) {
		r = c; g = x; b = 0;
	} else if (h >= 60 && h < 120) {
		r = x; g = c; b = 0;
	} else if (h >= 120 && h < 180) {
		r = 0; g = c; b = x;
	} else if (h >= 180 && h < 240) {
		r = 0; g = x; b = c;
	} else if (h >= 240 && h < 300) {
		r = x; g = 0; b = c;
	} else if (h >= 300 && h < 360) {
		r = c; g = 0; b = x;
	}
	
	const toHex = (n: number) => {
		const hex = Math.round((n + m) * 255).toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};
	
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Generates initials from a name or email
 * @param name - Name or email string
 * @returns Initials (max 2 characters)
 */
export function getInitials(name: string): string {
	if (!name) return '??';
	
	// If it's an email, use the part before @
	if (name.includes('@')) {
		name = name.split('@')[0];
	}
	
	// Split by spaces, dots, dashes, or underscores
	const parts = name.split(/[\s.\-_]+/).filter(Boolean);
	
	if (parts.length === 0) return '??';
	if (parts.length === 1) {
		// Take first two characters of single word
		return parts[0].substring(0, 2).toUpperCase();
	}
	
	// Take first character of first two parts
	return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Generates a gradient from two colors based on a string
 * @param str - The input string to generate colors from
 * @param direction - Gradient direction (e.g., 'to right', 'to bottom')
 * @returns CSS gradient string
 */
export function stringToGradient(str: string, direction: string = 'to right'): string {
	if (!str) return `linear-gradient(${direction}, #6B7280, #9CA3AF)`;
	
	// Generate two different hashes for two colors
	let hash1 = 0;
	let hash2 = 0;
	
	for (let i = 0; i < str.length; i++) {
		hash1 = str.charCodeAt(i) + ((hash1 << 5) - hash1);
		hash2 = str.charCodeAt(i) + ((hash2 << 3) - hash2);
	}
	
	const color1 = stringToColor(str);
	const color2 = stringToColor(str.split('').reverse().join(''));
	
	return `linear-gradient(${direction}, ${color1}, ${color2})`;
}
