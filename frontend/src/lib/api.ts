// API client for Smasara
// Because we have proxy in vite.config.ts, we can just hit /api/...

export class ApiError extends Error {
	status: number;
	data: unknown;

	constructor(status: number, message: string, data?: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.data = data;
	}
}

export async function fetchApi<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
	const defaultOptions: RequestInit = {
		headers: {
			'Content-Type': 'application/json',
			...options.headers
		},
		// include credentials so HTTP-Only cookies are sent
		credentials: 'same-origin',
		...options
	};

	try {
		const res = await fetch(path, defaultOptions);
		const data = (await res.json().catch(() => null)) as unknown;

		if (!res.ok) {
			const errorMsg =
				data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
					? data.error
					: `HTTP error! status: ${res.status}`;
			throw new ApiError(res.status, errorMsg, data);
		}

		return data as T;
	} catch (err: unknown) {
		if (err instanceof ApiError) {
			throw err;
		}
		console.error(`[API Error] ${path}:`, err);
		throw err;
	}
}
