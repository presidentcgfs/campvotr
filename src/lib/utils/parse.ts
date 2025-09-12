import type { ZodObject } from 'zod';

export async function extractResponse(response: Request) {
	if (response.headers.get('content-type') == 'application/json') {
		return response.json();
	}
	const ret = {};
	const form = await response.formData();
	for (const [k, v] of form) {
		set(k, v, ret);
	}
	return ret;
}

export async function parseResponse<T extends ZodObject>(
	z: T,
	response: Request,
	override: unknown = {}
) {
	const data = await extractResponse(response);
	return z.parse(typeof override === 'function' ? override(data) : Object.assign(data, override));
}

/**
 * Sets a value at a given dot notation path in an object, creating nested objects and arrays as needed.
 *
 * @param path - Dot notation path (e.g., "user.profile.name" or "items[0].title")
 * @param value - The value to set
 * @param target - Optional target object to modify (defaults to empty object)
 * @returns The object with the value set at the specified path
 *
 * @example
 * set("user.name", "John") // { user: { name: "John" } }
 * set("items[0].title", "First Item") // { items: [{ title: "First Item" }] }
 * set("data.users[1].profile.age", 25) // { data: { users: [undefined, { profile: { age: 25 } }] } }
 */
export function set(path: string, value: any, target: any = {}): any {
	if (!path) {
		return target;
	}

	// Split the path into segments, handling array notation
	const segments = path.split(/[.\[\]]/).filter((segment) => segment !== '');

	let current = target;

	for (let i = 0; i < segments.length - 1; i++) {
		const segment = segments[i];
		const nextSegment = segments[i + 1];

		// Check if the next segment is a number (array index)
		const isNextArray = /^\d+$/.test(nextSegment);

		// If current segment doesn't exist, create it
		if (!(segment in current)) {
			// Check if current segment is a number (we're in an array)
			if (/^\d+$/.test(segment)) {
				// We're setting an array index, ensure parent is an array
				current[parseInt(segment, 10)] = isNextArray ? [] : {};
			} else {
				// Create object or array based on next segment
				current[segment] = isNextArray ? [] : {};
			}
		}

		// Move to the next level
		if (/^\d+$/.test(segment)) {
			const index = parseInt(segment, 10);
			if (current[index] === undefined) {
				current[index] = isNextArray ? [] : {};
			}
			current = current[index];
		} else {
			current = current[segment];
		}
	}

	// Set the final value
	const finalSegment = segments[segments.length - 1];
	if (/^\d+$/.test(finalSegment)) {
		const index = parseInt(finalSegment, 10);
		current[index] = value;
	} else {
		current[finalSegment] = value;
	}

	return target;
}
