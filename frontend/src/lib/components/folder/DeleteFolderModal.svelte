<script lang="ts">
	import type { FolderItem } from '$lib/types';

	let {
		isOpen = false,
		folder,
		isDeleting = false,
		onClose,
		onConfirm
	}: {
		isOpen: boolean;
		folder: FolderItem | null;
		isDeleting?: boolean;
		onClose: () => void;
		onConfirm: () => void;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (isOpen && e.key === 'Escape' && !isDeleting) {
			onClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen && folder}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-4"
		>
			<div class="flex items-start gap-3.5">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 border border-red-200/60 dark:border-red-900/40"
				>
					<svg
						class="h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				</div>
				<div class="space-y-1">
					<h3 class="text-base font-semibold text-[var(--text-primary)]">
						Hapus Folder "{folder.name}"
					</h3>
					<p class="text-xs text-[var(--text-muted)]">Konfirmasi penghapusan struktur folder</p>
				</div>
			</div>

			<div
				class="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-surface-subtle)] p-3.5 rounded-xl border border-[var(--border-app-subtle)]"
			>
				<p>
					Folder <strong class="text-[var(--text-primary)] font-semibold">"{folder.name}"</strong> dan
					seluruh subfolder di dalamnya akan dihapus.
				</p>
				<p class="text-emerald-700 dark:text-emerald-400 font-medium">
					✓ Catatan di dalam folder ini tidak akan hilang, melainkan dipindahkan secara aman ke
					kategori <em>Uncategorized</em>.
				</p>
			</div>

			<div class="flex items-center justify-end gap-2.5 pt-2">
				<button
					type="button"
					disabled={isDeleting}
					onclick={onClose}
					class="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
				>
					Batal
				</button>
				<button
					type="button"
					disabled={isDeleting}
					onclick={onConfirm}
					data-testid="confirm-delete-folder-btn"
					class="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
				>
					{#if isDeleting}
						<svg class="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
						</svg>
						<span>Menghapus...</span>
					{:else}
						<span>Ya, Hapus Folder</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
