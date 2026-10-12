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
			class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors {themeStore.mode ===
			'light'
				? 'bg-[var(--text-primary)] text-[var(--bg-surface)] font-semibold shadow-2xs'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
			title="Tema Terang (Light)"
			aria-label="Mode Terang"
		>
			<svg
				class="h-3.5 w-3.5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.75"
			>
				<circle cx="12" cy="12" r="4" stroke-linecap="round" stroke-linejoin="round" />
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
				/>
			</svg>
			<span>Terang</span>
		</button>
		<button
			type="button"
			onclick={() => themeStore.setMode('normal')}
			class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors {themeStore.mode ===
			'normal'
				? 'bg-[var(--text-primary)] text-[var(--bg-surface)] font-semibold shadow-2xs'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
			title="Tema Sepia / Normal (Warm)"
			aria-label="Mode Sepia Normal"
		>
			<svg
				class="h-3.5 w-3.5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.75"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
				/>
			</svg>
			<span>Sepia</span>
		</button>
		<button
			type="button"
			onclick={() => themeStore.setMode('dark')}
			class="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-colors {themeStore.mode ===
			'dark'
				? 'bg-[var(--text-primary)] text-[var(--bg-surface)] font-semibold shadow-2xs'
				: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
			title="Tema Gelap (Dark)"
			aria-label="Mode Gelap"
		>
			<svg
				class="h-3.5 w-3.5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.75"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
				/>
			</svg>
			<span>Gelap</span>
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
