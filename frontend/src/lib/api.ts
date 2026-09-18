// API client for Smasara
// Because we have proxy in vite.config.ts, we can just hit /api/...

export async function fetchApi(path: string, options: RequestInit = {}) {
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
		const data = await res.json().catch(() => null);

		if (!res.ok) {
			throw new Error(data?.error || `HTTP error! status: ${res.status}`);
		}

		return data;
	} catch (err: any) {
		console.error(`[API Error] ${path}:`, err);
		throw err;
	}
}
