<script lang="ts">
	interface Props {
		isOpen: boolean;
		currentTitle: string;
		currentContent: string;
		serverContent: string;
		serverVersion: number;
		onKeepLocal: () => void;
		onAcceptServer: () => void;
		onCancel: () => void;
	}

	let {
		isOpen,
		currentTitle,
		currentContent,
		serverContent,
		serverVersion,
		onKeepLocal,
		onAcceptServer,
		onCancel
	}: Props = $props();
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-2xl rounded-2xl border border-red-500/20 bg-[var(--bg-surface)] p-6 shadow-2xl transition-all text-[var(--text-primary)]"
		>
			<div class="flex items-start gap-3 border-b border-[var(--border-app-subtle)] pb-4">
				<div class="rounded-full bg-red-100 p-2 text-red-600">
					<svg
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
				</div>
				<div>
					<h3 class="text-lg font-bold text-[var(--text-primary)]">
						Konflik Versi Dokumen (HTTP 409)
					</h3>
					<p class="text-sm text-[var(--text-secondary)] mt-0.5">
						Dokumen "{currentTitle}" telah diubah di server (versi saat ini: {serverVersion}).
						Simpanan lokal Anda tertinggal.
					</p>
				</div>
			</div>

			<div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
				<!-- Versi Lokal Kamu -->
				<div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex flex-col">
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-bold uppercase tracking-wider text-amber-500">
							Versi Editan Anda (Lokal)
						</span>
						<span class="text-xs text-amber-500 bg-amber-500/20 px-2 py-0.5 rounded-full font-mono">
							Belum Tersimpan
						</span>
					</div>
					<div
						class="flex-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface)] p-2.5 font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap select-all"
					>
						{currentContent || '(Konten kosong)'}
					</div>
				</div>

				<div class="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 flex flex-col">
					<div class="flex items-center justify-between mb-2">
						<span class="text-xs font-bold uppercase tracking-wider text-blue-500">
							Versi Server (Terbaru)
						</span>
						<span class="text-xs text-blue-500 bg-blue-500/20 px-2 py-0.5 rounded-full font-mono">
							Versi {serverVersion}
						</span>
					</div>
					<div
						class="flex-1 max-h-48 overflow-y-auto rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface)] p-2.5 font-mono text-xs text-[var(--text-primary)] whitespace-pre-wrap select-all"
					>
						{serverContent || '(Konten kosong)'}
					</div>
				</div>
			</div>

			<div
				class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-app-subtle)] pt-4"
			>
				<button type="button" onclick={onCancel} class="btn-ghost">
					Batal Simpan (Tinjau Lagi)
				</button>

				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={onAcceptServer}
						class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-xs"
					>
						Muat Versi Server (Timpa Lokal)
					</button>

					<button
						type="button"
						onclick={onKeepLocal}
						class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors shadow-xs"
						title="Memperbarui nomor versi dokumen dan menimpa konten server dengan editan lokal Anda"
					>
						Paksa Timpa Server
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
