import type { Handle } from '@sveltejs/kit';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const handle: Handle = async ({ event, resolve }) => {
	// Teruskan request /api ke Go Fiber backend saat berjalan di Node server production
	if (event.url.pathname.startsWith('/api')) {
		const targetUrl = new URL(event.url.pathname + event.url.search, BACKEND_URL);

		const headers = new Headers(event.request.headers);
		// Update host header agar sesuai dengan backend target
		headers.set('host', targetUrl.host);

		const init: RequestInit = {
			method: event.request.method,
			headers,
			// Hanya kirim body jika bukan method GET atau HEAD
			body:
				event.request.method !== 'GET' && event.request.method !== 'HEAD'
					? await event.request.arrayBuffer()
					: undefined
		};

		const response = await fetch(targetUrl.toString(), init);
		return response;
	}

	return resolve(event);
};
