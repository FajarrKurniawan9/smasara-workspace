<script lang="ts">
	import { fetchApi } from '$lib/api';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import { folderStore } from '$lib/stores/folder.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { DocumentItem } from '$lib/types';
	let {
		onDocumentRestored
	}: {
		onDocumentRestored?: (doc: DocumentItem) => void;
	} = $props();

	let trashedDocs = $state<DocumentItem[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let restoringDocId = $state<string | null>(null);

	// State modal konfirmasi hapus permanen
	let isHardDeleteModalOpen = $state(false);
	let docToHardDelete = $state<DocumentItem | null>(null);
	let isHardDeleting = $state(false);

	let filteredDocs = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return trashedDocs;
		return trashedDocs.filter(
			(d) => d.title.toLowerCase().includes(q) || (d.slug && d.slug.toLowerCase().includes(q))
		);
	});

	async function loadTrashedDocuments() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId) return;

		try {
			isLoading = true;
			const res = await fetchApi<{ documents: DocumentItem[] }>(
				`/api/workspaces/${wsId}/documents/trash`
			);
			trashedDocs = res.documents || [];
		} catch (err: unknown) {
			console.error('Gagal mengambil data catatan di Recycle Bin:', err);
			const msg = err instanceof Error ? err.message : 'Gagal memuat catatan di Recycle Bin';
			toast.error(msg);
		} finally {
			isLoading = false;
		}
	}

	async function handleRestore(doc: DocumentItem) {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId) return;

		try {
			restoringDocId = doc.id;
			await fetchApi(`/api/workspaces/${wsId}/documents/${doc.id}/restore`, {
				method: 'PATCH'
			});
			toast.success(`Catatan "${doc.title}" berhasil dipulihkan!`);
			trashedDocs = trashedDocs.filter((d) => d.id !== doc.id);
			if (onDocumentRestored) {
				onDocumentRestored(doc);
			}
			window.dispatchEvent(
				new CustomEvent('documentrestored', {
					detail: { document: doc }
				})
			);
		} catch (err: unknown) {
			console.error('Gagal memulihkan catatan:', err);
			const msg = err instanceof Error ? err.message : 'Gagal memulihkan catatan';
			toast.error(msg);
		} finally {
			restoringDocId = null;
		}
	}

	function promptHardDelete(doc: DocumentItem) {
		docToHardDelete = doc;
		isHardDeleteModalOpen = true;
	}

	async function confirmHardDelete() {
		if (!docToHardDelete) return;
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId) return;

		try {
			isHardDeleting = true;
			await fetchApi(`/api/workspaces/${wsId}/documents/${docToHardDelete.id}/hard`, {
				method: 'DELETE'
			});
			toast.success(`Catatan "${docToHardDelete.title}" telah dihapus secara permanen.`);
			trashedDocs = trashedDocs.filter((d) => d.id !== docToHardDelete?.id);
			isHardDeleteModalOpen = false;
			docToHardDelete = null;
		} catch (err: unknown) {
			console.error('Gagal menghapus catatan permanen:', err);
			const msg = err instanceof Error ? err.message : 'Gagal menghapus catatan permanen';
			toast.error(msg);
		} finally {
			isHardDeleting = false;
		}
	}

	function cancelHardDelete() {
		isHardDeleteModalOpen = false;
		docToHardDelete = null;
	}

	function formatDate(dateStr: string | null | undefined): string {
		if (!dateStr) return '-';
		try {
			const d = new Date(dateStr);
			return d.toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		} catch {
			return dateStr;
		}
	}

	$effect(() => {
		// Muat ulang bila workspace aktif berganti
		if (workspaceStore.currentWorkspaceId) {
			loadTrashedDocuments();
		}
	});
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isHardDeleteModalOpen && !isHardDeleting) {
			cancelHardDelete();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="h-full flex flex-col overflow-y-auto p-6 md:p-8 max-w-5xl mx-auto space-y-6 w-full">
	<!-- Header Bar -->
	<div
		class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-app-subtle)]"
	>
		<div class="flex items-center gap-3">
			<div
				class="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200/60 dark:border-red-900/40 shadow-xs"
			>
				<svg
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.75"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
					/>
				</svg>
			</div>
			<div>
				<h1 class="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
					Recycle Bin
				</h1>
				<p class="text-xs text-[var(--text-muted)] mt-0.5">
					Catatan yang dipindahkan ke sini dapat dipulihkan kembali atau dihapus secara permanen.
				</p>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={loadTrashedDocuments}
				title="Segarkan daftar"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-xl hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] shadow-2xs transition-colors cursor-pointer"
			>
				<svg
					class="w-3.5 h-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				<span>Segarkan</span>
			</button>
			<button
				type="button"
				onclick={() => folderStore.openDocumentEditor()}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-xl hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] shadow-2xs transition-colors cursor-pointer"
			>
				<svg
					class="w-3.5 h-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
				<span>Kembali ke Catatan</span>
			</button>
		</div>
	</div>

	<!-- Content Area -->
	{#if isLoading}
		<div class="py-16 text-center">
			<div class="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] animate-pulse">
				<svg class="w-4 h-4 animate-spin text-emerald-600" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
				</svg>
				<span>Memuat catatan di Recycle Bin...</span>
			</div>
		</div>
	{:else if trashedDocs.length === 0}
		<!-- Empty State -->
		<div
			class="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-xs"
		>
			<div
				class="mb-3.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--bg-surface-subtle)] text-[var(--text-muted)] border border-[var(--border-app-subtle)]"
			>
				<svg
					class="h-7 w-7"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
					/>
				</svg>
			</div>
			<h2 class="text-base font-semibold text-[var(--text-primary)] tracking-tight">
				Recycle Bin Kosong
			</h2>
			<p class="text-xs text-[var(--text-secondary)] mt-1 max-w-sm leading-relaxed">
				Tidak ada catatan yang sedang dihapus. Catatan yang Anda hapus sementara akan tersimpan di
				sini dan dapat dipulihkan sewaktu-waktu.
			</p>
			<button
				type="button"
				onclick={() => folderStore.openDocumentEditor()}
				class="mt-5 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer"
			>
				<svg
					class="w-3.5 h-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				<span>Kembali ke Editor Catatan</span>
			</button>
		</div>
	{:else}
		<!-- Trashed Notes List -->
		<div class="space-y-4">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<div class="flex items-center gap-2">
					<span class="text-xs font-semibold text-[var(--text-primary)]">
						{trashedDocs.length} Catatan di Recycle Bin
					</span>
					<span class="text-xs text-[var(--text-muted)]"
						>• Klik Pulihkan untuk mengembalikan ke catatan aktif</span
					>
				</div>
				<div class="relative w-full sm:w-64">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Cari catatan terhapus..."
						class="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-3 py-1.5 pl-8 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-emerald-500 focus:outline-hidden"
					/>
					<svg
						class="absolute left-2.5 top-2 h-3.5 w-3.5 text-[var(--text-muted)]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>
			</div>

			<div
				class="divide-y divide-[var(--border-app-subtle)] rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-xs overflow-hidden"
			>
				{#each filteredDocs as doc (doc.id)}
					<div
						class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-[var(--bg-surface-subtle)] transition-colors"
						data-testid="trashed-doc-item-{doc.id}"
					>
						<div class="min-w-0 flex-1 space-y-1">
							<div class="flex items-center gap-2">
								<svg
									class="w-4 h-4 text-zinc-400 shrink-0"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="1.75"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									/>
								</svg>
								<h3 class="text-sm font-semibold text-[var(--text-primary)] truncate">
									{doc.title || 'Tanpa Judul'}
								</h3>
							</div>
							<div class="flex items-center gap-3 text-xs text-[var(--text-muted)]">
								{#if doc.slug}
									<span
										class="font-mono text-[11px] bg-[var(--bg-surface-subtle)] px-1.5 py-0.5 rounded border border-[var(--border-app-subtle)]"
									>
										[[{doc.slug}]]
									</span>
								{/if}
								<span>Dihapus: {formatDate(doc.deleted_at)}</span>
							</div>
						</div>

						<div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
							<!-- Tombol Pulihkan -->
							<button
								type="button"
								disabled={restoringDocId !== null}
								onclick={() => handleRestore(doc)}
								data-testid="restore-doc-btn"
								data-testid-doc={doc.id}
								title="Pulihkan catatan ini"
								class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
							>
								{#if restoringDocId === doc.id}
									<svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
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
									<span>Memulihkan...</span>
								{:else}
									<svg
										class="w-3.5 h-3.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M3 10h10a5 5 0 015 5v2m-15-7l4-4m-4 4l4 4"
										/>
									</svg>
									<span>Pulihkan</span>
								{/if}
							</button>

							<!-- Tombol Hapus Permanen -->
							<button
								type="button"
								onclick={() => promptHardDelete(doc)}
								data-testid="hard-delete-doc-btn"
								data-testid-doc={doc.id}
								title="Hapus permanen dari basis data"
								class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50/50 dark:bg-red-950/20 dark:text-red-400 border border-red-200/80 dark:border-red-900/60 rounded-xl hover:bg-red-100/70 hover:text-red-700 transition-colors cursor-pointer"
							>
								<svg
									class="w-3.5 h-3.5"
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
								<span>Hapus Permanen</span>
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- Modal Konfirmasi Hapus Permanen -->
{#if isHardDeleteModalOpen && docToHardDelete}
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
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</div>
				<div class="space-y-1">
					<h3 class="text-base font-semibold text-[var(--text-primary)]">Hapus Catatan Permanen</h3>
					<p class="text-xs text-[var(--text-muted)]">Tindakan ini tidak dapat dibatalkan</p>
				</div>
			</div>

			<p class="text-sm text-[var(--text-secondary)] leading-relaxed">
				Apakah Anda yakin ingin menghapus catatan <strong
					class="text-[var(--text-primary)] font-semibold">"{docToHardDelete.title}"</strong
				> secara permanen? Seluruh konten akan dihapus dari server dan tidak dapat dipulihkan kembali.
			</p>

			<div class="flex items-center justify-end gap-2.5 pt-2">
				<button
					type="button"
					onclick={cancelHardDelete}
					class="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
				>
					Batal
				</button>
				<button
					type="button"
					disabled={isHardDeleting}
					onclick={confirmHardDelete}
					data-testid="confirm-hard-delete-btn"
					class="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
				>
					{#if isHardDeleting}
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
						<span>Ya, Hapus Permanen</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
