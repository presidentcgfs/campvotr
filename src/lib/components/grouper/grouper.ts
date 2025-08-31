import type { SvelteComponent } from 'svelte';

export interface GroupConfig<T> {
	key: string;
	label?: string;
	enabled?: boolean;
	value?: string | ((item: T) => string | number | null | undefined) | undefined;
	component?: SvelteComponent | string;
	sort?: 'asc' | 'desc' | ((a: string, b: string) => number);
	filter?: (item: T) => boolean;
	collapseEmpty?: boolean;
}

export interface GroupNode<T> {
	key: string;
	value: string;
	config: GroupConfig<T>;
	depth: number;
	items: T[];
	children: Map<string, GroupNode<T>>;
	path: Array<{ key: string; value: string }>;
}

/**
 * Get value from item using key path (e.g., "field.name")
 */
function getValueByPath<T>(item: T, path: string): any {
	return path.split('.').reduce((obj, key) => obj?.[key], item as any);
}

/**
 * Extract group value from item using GroupConfig.value
 */
function extractGroupValue<T>(item: T, config: GroupConfig<T>): string {
	if (config.value === undefined) {
		// Default to identity (entire item coerced to string)
		return String(item);
	}

	if (typeof config.value === 'string') {
		// Key path support
		const value = getValueByPath(item, config.value);
		return value == null ? '(unspecified)' : String(value);
	}

	if (typeof config.value === 'function') {
		// Function to derive value
		const value = config.value(item);
		return value == null ? '(unspecified)' : String(value);
	}

	return '(unspecified)';
}

/**
 * Sort group keys according to GroupConfig.sort
 */
function sortGroupKeys(keys: string[], sort?: GroupConfig<any>['sort']): string[] {
	if (!sort) {
		return keys; // Preserve insertion order
	}

	if (sort === 'asc') {
		return keys.toSorted();
	}

	if (sort === 'desc') {
		return keys.toReversed().sort();
	}

	if (typeof sort === 'function') {
		return keys.toSorted(sort);
	}

	return keys;
}

/**
 * Build nested group structure recursively
 */
export function buildGroupTree<T>(
	items: T[],
	configs: GroupConfig<T>[],
	depth: number = 0,
	path: Array<{ key: string; value: string }> = []
): Map<string, GroupNode<T>> {
	const groups = new Map<string, GroupNode<T>>();

	if (configs.length === 0) {
		// No more grouping rules - return items as leaf nodes
		return groups;
	}

	const [currentConfig, ...remainingConfigs] = configs;

	// Apply filter if present
	const filteredItems = currentConfig.filter ? items.filter(currentConfig.filter) : items;

	// Group items by current config
	const itemGroups = new Map<string, T[]>();

	filteredItems.forEach((item) => {
		const groupValue = extractGroupValue(item, currentConfig);
		if (!itemGroups.has(groupValue)) {
			itemGroups.set(groupValue, []);
		}
		itemGroups.get(groupValue)!.push(item);
	});

	// Sort group keys
	const sortedKeys = sortGroupKeys(Array.from(itemGroups.keys()), currentConfig.sort);

	// Build group nodes
	sortedKeys.forEach((groupValue) => {
		const groupItems = itemGroups.get(groupValue)!;

		// Skip empty groups if collapseEmpty is true (default)
		if (currentConfig.collapseEmpty !== false && groupItems.length === 0) {
			return;
		}

		const currentPath = [...path, { key: currentConfig.key, value: groupValue }];

		const groupNode: GroupNode<T> = {
			key: currentConfig.key,
			value: groupValue,
			config: currentConfig,
			depth,
			items: groupItems,
			children: buildGroupTree(groupItems, remainingConfigs, depth + 1, currentPath),
			path: currentPath
		};

		groups.set(groupValue, groupNode);
	});

	return groups;
}

/**
 * Main grouping function
 */
export function groupItems<T>(
	items: T[],
	groups: GroupConfig<T>[],
	activeGroupKey?: string | null
): Map<string, GroupNode<T>> {
	// Filter to enabled groups only
	let enabledGroups = groups.filter((g) => g.enabled !== false);

	// If activeGroupKey is specified, only use that group (if it exists and is enabled)
	if (activeGroupKey) {
		const targetGroup = enabledGroups.find((g) => g.key === activeGroupKey);
		enabledGroups = targetGroup ? [targetGroup] : [];
	}

	return buildGroupTree(items, enabledGroups);
}
