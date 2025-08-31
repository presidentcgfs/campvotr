import type { Transport } from '@sveltejs/kit';
import './polyfill';

export const transport: Transport = {
	Temporal: {
		encode: (value) => value instanceof Date && value.toISOString(),
		decode: (value: string) => new Date(value)
	}
};
