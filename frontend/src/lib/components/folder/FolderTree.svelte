<script lang="ts">
	import { folderStore } from '$lib/stores/folder.svelte';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { FolderItem, DocumentItem } from '$lib/types';
	import FolderTreeItem from './FolderTreeItem.svelte';
	import CreateFolderModal from './CreateFolderModal.svelte';
	import DeleteFolderModal from './DeleteFolderModal.svelte';

	let isModalOpen = $state(false);
	let targetParentFolder = $state<FolderItem | null>(null);
	let isDragOverUncategorized = $state(false);

	// State modal hapus folder
	let isDeleteModalOpen = $state(false);
	let folderToDelete = $state<FolderItem | null>(null);
	let isDeletingFolder = $state(false);

	function openCreateRootFolder() {
		targetParentFolder = null;
		isModalOpen = true;
	}

	function handleAddSubfolder(parent: FolderItem) {
		targetParentFolder = parent;
		isModalOpen = true;
	}

	async function handleCreateFolder(name: string) {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId) return;
		await folderStore.createFolder(wsId, name, targetParentFolder?.id || null);
	}

	function handleDeleteFolder(folder: FolderItem) {
		folderToDelete = folder;
		isDeleteModalOpen = true;
	}

	async function handleConfirmDeleteFolder() {
		if (!folderToDelete) return;
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId) return;

		const targetFolderId = folderToDelete.id;
		const targetFolderName = folderToDelete.name;

		try {
			isDeletingFolder = true;
			await folderStore.deleteFolder(wsId, targetFolderId);
			toast.success(`Folder "${targetFolderName}" berhasil dihapus.`);
			window.dispatchEvent(
				new CustomEvent('folderdeleted', { detail: { folderId: targetFolderId } })
			);
			isDeleteModalOpen = false;
			folderToDelete = null;
		} catch (err) {
			console.error('Gagal menghapus folder:', err);
			toast.error('Gagal menghapus folder');
		} finally {
			isDeletingFolder = false;
		}
	}

	async function handleDropToUncategorized(e: DragEvent) {
		e.preventDefault();
		isDragOverUncategorized = false;
		const rawData = e.dataTransfer?.getData('application/json');
		if (!rawData) return;

		try {
			const doc: DocumentItem = JSON.parse(rawData);
			if (doc.folder_id === null) return;

			const wsId = workspaceStore.currentWorkspaceId;
			if (!wsId) return;
			await folderStore.moveDocumentToFolder(wsId, doc, null);
			window.dispatchEvent(new CustomEvent('documentmoved', { detail: { documentId: doc.id } }));
		} catch (err) {
			console.error('Gagal memindahkan dokumen ke Uncategorized:', err);
		}
	}
</script>

<div class="space-y-1">
	<div class="flex items-center justify-between px-2 py-1.5">
		<span class="text-[11px] font-bold uppercase tracking-wider text-gray-400"> Folders </span>
		<button
			type="button"
			onclick={openCreateRootFolder}
			title="Buat Folder Baru"
			class="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
		>
			<span>+</span>
			<span>Folder</span>
		</button>
	</div>

	<!-- Filter: Semua Dokumen -->
	<button
		type="button"
		onclick={() => folderStore.selectFolder(null)}
		class="w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer text-xs transition-colors {folderStore.filterMode ===
		'all'
			? 'bg-emerald-50 text-emerald-900 font-semibold'
			: 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900'}"
	>
		<div class="flex items-center gap-2">
			<svg
				class="w-3.5 h-3.5 {folderStore.filterMode === 'all'
					? 'text-emerald-600'
					: 'text-gray-400'}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
				/>
			</svg>
			<span>Semua Catatan</span>
		</div>
	</button>

	<!-- Filter: Uncategorized (Quick Notes tanpa folder) -->
	<div
		role="group"
		ondragover={(e) => {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
			isDragOverUncategorized = true;
		}}
		ondragleave={() => (isDragOverUncategorized = false)}
		ondrop={handleDropToUncategorized}
		class="rounded-lg transition-colors {isDragOverUncategorized
			? 'bg-amber-100 ring-2 ring-amber-500'
			: ''}"
	>
		<button
			type="button"
			onclick={() => folderStore.setUncategorizedFilter()}
			class="w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer text-xs transition-colors {folderStore.filterMode ===
			'uncategorized'
				? 'bg-emerald-50 text-emerald-900 font-semibold'
				: 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900'}"
		>
			<div class="flex items-center gap-2">
				<svg
					class="w-3.5 h-3.5 {folderStore.filterMode === 'uncategorized'
						? 'text-emerald-600'
						: 'text-gray-400'}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
					/>
				</svg>
				<span>Uncategorized</span>
			</div>
		</button>
	</div>

	<!-- Tree View Folder -->
	{#if folderStore.isLoading && folderStore.folders.length === 0}
		<div class="px-3 py-2 text-xs text-gray-400 animate-pulse">Memuat folder...</div>
	{:else if folderStore.tree.length > 0}
		<div class="space-y-0.5 pt-1">
			{#each folderStore.tree as node (node.id)}
				<FolderTreeItem
					{node}
					depth={0}
					onAddSubfolder={handleAddSubfolder}
					onDeleteFolder={handleDeleteFolder}
				/>
			{/each}
		</div>
	{:else}
		<div class="px-2 py-2 text-xs text-gray-400">Belum ada folder</div>
	{/if}

	<!-- Recycle Bin (Pulihkan Catatan) -->
	<div class="pt-2 mt-2 border-t border-gray-200/60 dark:border-zinc-800">
		<button
			type="button"
			onclick={() => folderStore.openTrashView()}
			data-testid="recycle-bin-btn"
			title="Buka Recycle Bin untuk memulihkan catatan"
			class="w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg cursor-pointer text-xs transition-colors {folderStore.viewMode ===
			'trash'
				? 'bg-red-50 text-red-900 font-semibold dark:bg-red-950/40 dark:text-red-300'
				: 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900 dark:text-zinc-300 dark:hover:bg-zinc-800'}"
		>
			<div class="flex items-center gap-2">
				<svg
					class="w-3.5 h-3.5 {folderStore.viewMode === 'trash'
						? 'text-red-600 dark:text-red-400'
						: 'text-gray-400 dark:text-zinc-400'}"
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
				<span>Recycle Bin</span>
			</div>
		</button>
	</div>
</div>

<!-- Modal Pembuatan Folder -->
<CreateFolderModal
	isOpen={isModalOpen}
	parentFolderName={targetParentFolder?.name}
	onClose={() => (isModalOpen = false)}
	onCreate={handleCreateFolder}
/>

<!-- Modal Konfirmasi Hapus Folder -->
<DeleteFolderModal
	isOpen={isDeleteModalOpen}
	folder={folderToDelete}
	isDeleting={isDeletingFolder}
	onClose={() => {
		isDeleteModalOpen = false;
		folderToDelete = null;
	}}
	onConfirm={handleConfirmDeleteFolder}
/>
