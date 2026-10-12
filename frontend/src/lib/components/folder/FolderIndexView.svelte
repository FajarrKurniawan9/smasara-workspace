<script lang="ts">
	import { folderStore } from '$lib/stores/folder.svelte';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { DocumentItem } from '$lib/types';
	import { getDocumentStatus } from '$lib/types';
	import { DocumentStatusBadge } from '$lib/components/document';
	import DeleteFolderModal from './DeleteFolderModal.svelte';
	let {
		documents = [],
		onSelectDocument,
		onCreateDocument
	}: {
		documents: DocumentItem[];
		onSelectDocument: (doc: DocumentItem) => void;
		onCreateDocument: () => void;
	} = $props();

	let folder = $derived(folderStore.selectedFolderDetail?.folder || folderStore.selectedFolder);
	let indexDoc = $derived(folderStore.selectedFolderDetail?.index_document);
	let isSettingIndex = $state(false);
	let selectedDocForIndex = $state('');
	let isDeleteModalOpen = $state(false);
	let isDeletingFolder = $state(false);
	let folderDocs = $derived(documents.filter((d) => folder && d.folder_id === folder.id));

	async function handleSetIndex() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || !folder || !selectedDocForIndex) return;
		try {
			await folderStore.setFolderIndex(wsId, folder.id, selectedDocForIndex);
			isSettingIndex = false;
			selectedDocForIndex = '';
			toast.success('Dokumen indeks folder berhasil diperbarui!');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Gagal menetapkan dokumen indeks folder';
			console.error('Gagal menetapkan dokumen indeks:', err);
			toast.error(msg);
		}
	}

	async function handleClearIndex() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || !folder) return;
		try {
			await folderStore.setFolderIndex(wsId, folder.id, null);
			toast.info('Dokumen indeks folder telah dilepas.');
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Gagal melepas dokumen indeks';
			console.error('Gagal melepas dokumen indeks:', err);
			toast.error(msg);
		}
	}

	async function handleCreateReadme() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || !folder) return;
		onCreateDocument();
	}

	async function handleConfirmDeleteFolder() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || !folder) return;
		const folderId = folder.id;
		const folderName = folder.name;
		try {
			isDeletingFolder = true;
			await folderStore.deleteFolder(wsId, folderId);
			toast.success(`Folder "${folderName}" berhasil dihapus.`);
			window.dispatchEvent(new CustomEvent('folderdeleted', { detail: { folderId } }));
			isDeleteModalOpen = false;
			folderStore.openDocumentEditor();
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : 'Gagal menghapus folder';
			console.error('Gagal menghapus folder:', err);
			toast.error(msg);
		} finally {
			isDeletingFolder = false;
		}
	}
</script>

<div class="h-full flex flex-col overflow-y-auto p-8 max-w-5xl mx-auto space-y-8">
	<!-- Folder Breadcrumb & Header -->
	<div class="flex items-center justify-between pb-4 border-b border-[var(--border-app-subtle)]">
		<div class="flex items-center gap-2">
			<span class="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider"
				>Folder</span
			>
			<span class="text-[var(--text-muted)]">/</span>
			<h1 class="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
				<svg class="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
					/>
				</svg>
				{folder?.name || 'Folder'}
			</h1>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => (isDeleteModalOpen = true)}
				data-testid="index-delete-folder-btn"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50/50 dark:bg-red-950/20 dark:text-red-400 border border-red-200/80 dark:border-red-900/60 rounded-xl hover:bg-red-100/70 hover:text-red-700 shadow-2xs transition-colors cursor-pointer"
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
				<span>Hapus Folder</span>
			</button>
			<button
				type="button"
				onclick={() => folderStore.openDocumentEditor()}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-xl hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] shadow-2xs transition-colors cursor-pointer"
			>
				<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				<span>Kembali ke Editor</span>
			</button>
		</div>
	</div>

	<!-- Section 1: Folder README (Index Document) -->
	<section
		class="rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-4"
	>
		<div class="flex items-center justify-between pb-3 border-b border-[var(--border-app-subtle)]">
			<div class="flex items-center gap-2">
				<span
					class="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5"
				>
					<svg
						class="w-4 h-4 text-emerald-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
						/>
					</svg>
					README / Dokumen Indeks
				</span>
				{#if indexDoc}
					<span class="text-[11px] font-mono text-[var(--text-muted)]">[[{indexDoc.slug}]]</span>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if indexDoc}
					<button
						type="button"
						onclick={() => {
							const target = documents.find((d) => d.id === indexDoc?.id);
							if (target) {
								folderStore.openDocumentEditor();
								onSelectDocument(target);
							}
						}}
						class="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
					>
						Edit Catatan Indeks
					</button>
					<span class="text-gray-300">•</span>
					<button
						type="button"
						onclick={handleClearIndex}
						class="text-xs font-medium text-red-500 hover:text-red-700 hover:underline cursor-pointer"
					>
						Lepas Indeks
					</button>
				{:else}
					<button
						type="button"
						onclick={() => (isSettingIndex = !isSettingIndex)}
						class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
					>
						<span>+</span>
						<span>{isSettingIndex ? 'Tutup Pilihan' : 'Pilih Catatan sebagai Indeks'}</span>
					</button>
				{/if}
			</div>
		</div>

		<!-- Dialog Inline Pemilihan Indeks -->
		{#if isSettingIndex && !indexDoc}
			<div
				class="p-3 bg-[var(--bg-surface-subtle)] rounded-xl border border-[var(--border-app)] space-y-2"
			>
				<p class="text-xs font-medium text-[var(--text-secondary)]">
					Pilih catatan yang ada di folder ini:
				</p>
				<div class="flex items-center gap-2">
					<select
						bind:value={selectedDocForIndex}
						class="flex-1 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-emerald-500 focus:outline-none"
					>
						<option value="">-- Pilih Catatan --</option>
						{#each folderDocs as d (d.id)}
							<option value={d.id}>{d.title} ([[{d.slug}]])</option>
						{/each}
					</select>
					<button
						type="button"
						onclick={handleSetIndex}
						disabled={!selectedDocForIndex}
						class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
					>
						Pasang
					</button>
				</div>
			</div>
		{/if}

		<!-- Konten Indeks -->
		{#if folderStore.isLoadingDetail}
			<div class="py-12 text-center text-xs text-[var(--text-muted)] animate-pulse">
				Memuat indeks folder...
			</div>
		{:else if indexDoc}
			<div class="space-y-2">
				<h2 class="text-lg font-bold text-[var(--text-primary)]">{indexDoc.title}</h2>
				<div
					class="prose prose-sm max-w-none text-[var(--text-secondary)] bg-[var(--bg-surface-subtle)]/50 p-4 rounded-xl border border-[var(--border-app-subtle)] whitespace-pre-wrap font-sans text-xs leading-relaxed"
				>
					{indexDoc.content || 'Catatan ini belum memiliki isi konten.'}
				</div>
			</div>
		{:else}
			<div
				class="py-8 text-center border-2 border-dashed border-[var(--border-app)] rounded-2xl space-y-3"
			>
				<p class="text-xs text-[var(--text-secondary)]">
					Folder ini belum memiliki dokumen indeks (README pengantar).
				</p>
				<div class="flex items-center justify-center gap-3">
					<button
						type="button"
						onclick={handleCreateReadme}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-2xs transition-colors cursor-pointer"
					>
						<span>+</span>
						<span>Buat Catatan Baru di Folder Ini</span>
					</button>
				</div>
			</div>
		{/if}
	</section>

	<!-- Section 2: Daftar Catatan Anggota Folder -->
	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
				Daftar Catatan dalam Folder ({folderDocs.length})
			</h2>
			<button
				type="button"
				onclick={onCreateDocument}
				class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
			>
				<span>+</span>
				<span>Catatan Baru</span>
			</button>
		</div>

		{#if folderDocs.length === 0}
			<div
				class="p-6 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] text-center text-xs text-[var(--text-muted)]"
			>
				Belum ada catatan di dalam folder ini.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each folderDocs as doc (doc.id)}
					<button
						type="button"
						onclick={() => {
							folderStore.openDocumentEditor();
							onSelectDocument(doc);
						}}
						class="text-left rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-4 shadow-xs hover:border-emerald-500/50 hover:bg-[var(--bg-surface-subtle)] hover:shadow-sm transition-all flex flex-col justify-between gap-3 group cursor-pointer"
					>
						<div class="space-y-1">
							<div class="flex items-start justify-between gap-2">
								<h3
									class="text-sm font-semibold text-[var(--text-primary)] group-hover:text-emerald-500 line-clamp-1"
								>
									{doc.title}
								</h3>
								<div class="flex items-center gap-1.5 shrink-0">
									{#if doc.id === indexDoc?.id}
										<span
											class="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold"
										>
											INDEX
										</span>
									{/if}
									<DocumentStatusBadge
										status={getDocumentStatus(doc, {
											memberCount: workspaceStore.memberCount,
											isIndexDocument: doc.id === indexDoc?.id
										})}
										collaboratorCount={workspaceStore.memberCount}
										size="xs"
										showIcon={false}
									/>
								</div>
							</div>
							<p class="text-xs text-[var(--text-muted)] font-mono">[[{doc.slug}]]</p>
						</div>

						<div
							class="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-app-subtle)]"
						>
							<span>v{doc.version}</span>
							<span>{new Date(doc.updated_at).toLocaleDateString('id-ID')}</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</section>
</div>

<DeleteFolderModal
	isOpen={isDeleteModalOpen}
	folder={folder || null}
	isDeleting={isDeletingFolder}
	onClose={() => (isDeleteModalOpen = false)}
	onConfirm={handleConfirmDeleteFolder}
/>
