<script lang="ts">
	import { fetchApi } from '$lib/api';
	import { auth } from '$lib/stores/auth.svelte';
	import { toast } from '$lib/stores/toast.svelte';
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
			let username: string | null = null;
			try {
				const profileData = await fetchApi<{ profile: { username: string } }>('/api/profiles/me');
				username = profileData.profile.username;
			} catch {
				// Abaikan jika belum ada profil
			}
			auth.setAuth(me.user_id, username);
			goto('/');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Login gagal';
			errorMsg = msg;
			toast.error(msg);
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-[26rem] card-smasara">
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Masuk Smasara</h1>
			<p class="mt-2 text-sm text-zinc-500">Lanjutkan ruang kerjamu</p>
		</div>

		{#if errorMsg}
			<div class="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-500/10">
				{errorMsg}
			</div>
		{/if}

		<form onsubmit={handleLogin} class="space-y-5">
			<div>
				<label for="email" class="text-sm font-medium text-zinc-700">Email</label>
				<input
					bind:value={email}
					type="email"
					id="email"
					required
					placeholder="Ditulis di sini..."
					class="input-smasara"
				/>
			</div>

			<div>
				<label for="password" class="text-sm font-medium text-zinc-700">Password</label>
				<input
					bind:value={password}
					type="password"
					id="password"
					required
					placeholder="Ditulis di sini..."
					class="input-smasara"
				/>
			</div>

			<button type="submit" disabled={isLoading} class="btn-primary mt-6">
				{isLoading ? 'Memproses...' : 'Login'}
			</button>
		</form>

		<p class="mt-8 text-center text-sm text-zinc-500">
			Belum punya akun? <a
				href="/register"
				class="font-medium text-zinc-900 underline decoration-zinc-300 decoration-1 underline-offset-4 transition-colors hover:decoration-zinc-900"
				>Daftar di sini</a
			>
		</p>
	</div>
</div>
