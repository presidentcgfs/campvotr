import type { ZodObject } from 'zod';

export async function extractResponse(response: Request) {
	if (response.headers.get('content-type') == 'application/json') {
		return response.json();
	}

	return Object.fromEntries(await response.formData());
}

export async function parseResponse<T extends ZodObject>(z: T, response: Request) {
	return z.parse(await extractResponse(response));
}
