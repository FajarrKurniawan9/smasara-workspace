<script lang="ts">
	import { fetchApi } from '$lib/api';
	import { toast } from '$lib/stores/toast.svelte';
	import { goto } from '$app/navigation';

	let email = $state('');
	let password = $state('');
	let errorMsg = $state('');
	let isLoading = $state(false);

	async function handleRegister(e: Event) {
		e.preventDefault();
		errorMsg = '';
		isLoading = true;

		try {
			// Register route: POST /api/register
			await fetchApi('/api/register', {
				method: 'POST',
				body: JSON.stringify({ email, password })
			});

			toast.success('Registrasi berhasil! Silakan login dengan akun Anda.');
			goto('/login');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Registrasi gagal';
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
			<h1 class="text-2xl font-semibold tracking-tight text-zinc-900">Daftar Smasara</h1>
			<p class="mt-2 text-sm text-zinc-500">Mulai ciptakan ekosistem tulisanmu</p>
		</div>

		{#if errorMsg}
			<div class="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 ring-1 ring-red-500/10">
				{errorMsg}
			</div>
		{/if}

		<form onsubmit={handleRegister} class="space-y-5">
			<div>
				<label for="email" class="text-sm font-medium text-zinc-700">Email</label>
				<input bind:value={email} type="email" id="email" required class="input-smasara" />
			</div>

			<div>
				<label for="password" class="text-sm font-medium text-zinc-700">Password</label>
				<input
					bind:value={password}
					type="password"
					id="password"
					required
					minlength="6"
					class="input-smasara"
				/>
			</div>

			<button type="submit" disabled={isLoading} class="btn-primary mt-6">
				{isLoading ? 'Memproses...' : 'Daftar Sekarang'}
			</button>
		</form>

		<p class="mt-8 text-center text-sm text-zinc-500">
			Sudah punya akun? <a
				href="/login"
				class="font-medium text-zinc-900 underline decoration-zinc-300 decoration-1 underline-offset-4 transition-colors hover:decoration-zinc-900"
				>Login di sini</a
			>
		</p>
	</div>
</div>
