<script lang="ts">
	import { fetchApi } from '$lib/api';
	import { themeStore } from '$lib/stores/theme.svelte';
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

<div
	class="relative flex min-h-screen items-center justify-center p-4 bg-[var(--bg-app)] transition-colors"
>
	<!-- Theme Selector di Halaman Auth -->
	<div
		class="absolute top-4 right-4 flex items-center gap-1 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-1 text-xs shadow-2xs transition-colors"
		data-testid="auth-theme-selector"
	>
		<button
			type="button"
			onclick={() => themeStore.setMode('light')}
			class="rounded-lg px-2.5 py-1 text-xs transition-colors {themeStore.mode === 'light'
				? 'bg-[var(--text-primary)] text-[var(--bg-surface)] font-semibold shadow-2xs'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
			title="Tema Terang (Light)"
			aria-label="Mode Terang"
		>
			☀️ Terang
		</button>
		<button
			type="button"
			onclick={() => themeStore.setMode('normal')}
			class="rounded-lg px-2.5 py-1 text-xs transition-colors {themeStore.mode === 'normal'
				? 'bg-[var(--text-primary)] text-[var(--bg-surface)] font-semibold shadow-2xs'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
			title="Tema Sepia / Normal (Warm)"
			aria-label="Mode Sepia Normal"
		>
			📜 Sepia
		</button>
		<button
			type="button"
			onclick={() => themeStore.setMode('dark')}
			class="rounded-lg px-2.5 py-1 text-xs transition-colors {themeStore.mode === 'dark'
				? 'bg-[var(--text-primary)] text-[var(--bg-surface)] font-semibold shadow-2xs'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
			title="Tema Gelap (Dark)"
			aria-label="Mode Gelap"
		>
			🌙 Gelap
		</button>
	</div>

	<div class="w-full max-w-[26rem] card-smasara">
		<div class="mb-8 text-center">
			<h1 class="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
				Daftar Smasara
			</h1>
			<p class="mt-2 text-sm text-[var(--text-secondary)]">Mulai ciptakan ekosistem tulisanmu</p>
		</div>

		{#if errorMsg}
			<div class="mb-6 rounded-xl bg-red-500/10 p-4 text-sm text-red-500 border border-red-500/20">
				{errorMsg}
			</div>
		{/if}

		<form onsubmit={handleRegister} class="space-y-5">
			<div>
				<label for="email" class="text-sm font-medium text-[var(--text-secondary)]">Email</label>
				<input bind:value={email} type="email" id="email" required class="input-smasara" />
			</div>

			<div>
				<label for="password" class="text-sm font-medium text-[var(--text-secondary)]"
					>Password</label
				>
				<input
					bind:value={password}
					type="password"
					id="password"
					required
					minlength="6"
					class="input-smasara"
				/>
			</div>

			<button type="submit" disabled={isLoading} class="btn-primary mt-6 cursor-pointer">
				{isLoading ? 'Memproses...' : 'Daftar Sekarang'}
			</button>
		</form>

		<p class="mt-8 text-center text-sm text-[var(--text-secondary)]">
			Sudah punya akun? <a
				href="/login"
				class="font-medium text-[var(--text-primary)] underline decoration-[var(--border-app)] decoration-1 underline-offset-4 transition-colors hover:decoration-[var(--text-primary)]"
				>Login di sini</a
			>
		</p>
	</div>
</div>
