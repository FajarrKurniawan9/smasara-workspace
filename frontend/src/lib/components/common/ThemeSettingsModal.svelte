<script lang="ts">
	import { themeStore, type ThemeMode, type FontOption } from '$lib/stores/theme.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			onClose();
		}
	}

	const themes: Array<{ id: ThemeMode; label: string; desc: string }> = [
		{
			id: 'light',
			label: 'Light Mode',
			desc: 'Bersih, minimalis dan cerah'
		},
		{
			id: 'dark',
			label: 'Dark Mode',
			desc: 'Nyaman untuk mata di malam hari'
		},
		{
			id: 'normal',
			label: 'Normal (Sepia)',
			desc: 'Hangat ala kertas bacaan buku'
		}
	];

	const fonts: Array<{ id: FontOption; label: string; desc: string; sample: string }> = [
		{
			id: 'sans',
			label: 'Sans-Serif (Google Sans)',
			desc: 'Geometris, modern & jernih ala Gemini',
			sample: 'Aa Catatan'
		},
		{
			id: 'serif',
			label: 'Serif (Anthropic Serif)',
			desc: 'Elegan, editorial & berkarakter ala Claude',
			sample: 'Aa Catatan'
		},
		{
			id: 'mono',
			label: 'Monospace (Google Sans Code)',
			desc: 'Teknis & terstruktur untuk kode',
			sample: 'Aa Catatan'
		}
	];
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs transition-opacity"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<div
			class="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-2xl transition-all"
			role="dialog"
			aria-modal="true"
			aria-labelledby="theme-settings-title"
			data-testid="theme-settings-modal"
		>
			<div
				class="mb-5 flex items-center justify-between border-b border-[var(--border-app-subtle)] pb-4"
			>
				<h2
					id="theme-settings-title"
					class="text-lg font-semibold tracking-tight text-[var(--text-primary)]"
				>
					Tampilan & Tipografi
				</h2>
				<button
					type="button"
					onclick={onClose}
					class="rounded-xl p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
					aria-label="Tutup"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Pilihan Tema -->
			<div class="mb-6">
				<span
					class="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
				>
					Tema Tampilan
				</span>
				<div class="grid grid-cols-3 gap-2.5">
					{#each themes as t (t.id)}
						<button
							type="button"
							onclick={() => themeStore.setMode(t.id)}
							class="flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all {themeStore.mode ===
							t.id
								? 'border-blue-500 bg-blue-50/20 text-[var(--text-primary)] ring-2 ring-blue-500/20 dark:bg-blue-900/20'
								: 'border-[var(--border-app)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-zinc-400 hover:text-[var(--text-primary)]'}"
							data-testid="theme-btn-{t.id}"
						>
							{#if t.id === 'light'}
								<svg
									class="h-5 w-5 mb-1.5"
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
							{:else if t.id === 'dark'}
								<svg
									class="h-5 w-5 mb-1.5"
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
							{:else}
								<svg
									class="h-5 w-5 mb-1.5"
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
							{/if}
							<span class="text-xs font-medium">{t.label}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Pilihan Tipografi -->
			<div class="mb-6">
				<span
					class="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
				>
					Tipografi Editor
				</span>
				<div class="space-y-2">
					{#each fonts as f (f.id)}
						<button
							type="button"
							onclick={() => themeStore.setFont(f.id)}
							class="flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all {themeStore.font ===
							f.id
								? 'border-blue-500 bg-blue-50/20 text-[var(--text-primary)] ring-2 ring-blue-500/20 dark:bg-blue-900/20'
								: 'border-[var(--border-app)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-zinc-400 hover:text-[var(--text-primary)]'}"
							data-testid="font-btn-{f.id}"
						>
							<div>
								<div class="text-sm font-medium text-[var(--text-primary)]">{f.label}</div>
								<div class="text-xs text-[var(--text-secondary)]">{f.desc}</div>
							</div>
							<span
								class="text-sm font-semibold opacity-70 {f.id === 'serif'
									? 'font-serif'
									: f.id === 'mono'
										? 'font-mono'
										: 'font-sans'}"
							>
								{f.sample}
							</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="flex justify-end pt-2">
				<button
					type="button"
					onclick={onClose}
					class="btn-primary w-auto px-5 py-2 text-xs"
					data-testid="theme-settings-close-btn"
				>
					Selesai
				</button>
			</div>
		</div>
	</div>
{/if}
