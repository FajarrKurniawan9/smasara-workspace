<script lang="ts">
	import { fetchApi } from '$lib/api';
	import { auth } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let isLoading = $state(false);

	async function handleLogin(e: Event) {
		e.preventDefault();
		errorMsg = '';
		isLoading = true;

		try {
			// Login route: POST /api/login
			await fetchApi('/api/login', {
				method: 'POST',
				body: JSON.stringify({ email, password })
			});

			// Verify if JWT is successfully stored by hitting /api/me
			const me = await fetchApi<{ user_id: string }>('/api/me');
			auth.setAuth(me.user_id);
			goto('/');
		} catch (err: any) {
			errorMsg = err.message || 'Login gagal';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-100">
	<div class="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
		<h1 class="mb-6 text-center text-3xl font-bold text-gray-800">Login ke Smasara</h1>

		{#if errorMsg}
			<div class="mb-4 rounded bg-red-100 p-3 text-red-700">{errorMsg}</div>
		{/if}

		<form onsubmit={handleLogin} class="space-y-4">
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
				<input
					bind:value={email}
					type="email"
					id="email"
					required
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
				<input
					bind:value={password}
					type="password"
					id="password"
					required
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				/>
			</div>

			<button
				type="submit"
				disabled={isLoading}
				class="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
			>
				{isLoading ? 'Memproses...' : 'Login'}
			</button>
		</form>

		<p class="mt-4 text-center text-sm text-gray-600">
			Belum punya akun? <a
				href="/register"
				class="font-medium text-indigo-600 hover:text-indigo-500">Daftar di sini</a
			>
		</p>
	</div>
</div>
