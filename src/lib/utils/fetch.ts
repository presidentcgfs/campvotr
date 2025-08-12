export class ErrorWithDetail extends Error {
	constructor(
		message: string,
		public status: number,
		public statusText: string,
		public detail?: any
	) {
		super(message);
		Object.setPrototypeOf(this, ErrorWithDetail.prototype);
		this.detail = detail;
	}
}
export async function postJSON(url: string, body: unknown) {
	const resp = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	if (!resp.ok) {
		try {
			const errorData = await resp.json();
			throw new ErrorWithDetail(
				'Failed to fetch data',
				resp.status,
				resp.statusText,
				errorData.error
			);
		} catch {
			throw new ErrorWithDetail('Failed to fetch data', resp.status, resp.statusText);
		}
	}

	return resp.json();
}
export async function getJSON(url: string): Promise<any> {
	const resp = await fetch(url, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json'
		}
	});
	if (!resp.ok) {
		throw new Error('Failed to fetch data');
	}

	return resp.json();
}
