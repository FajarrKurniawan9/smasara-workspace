<script lang="ts">
	import type { FolderItem, FolderTreeNode, DocumentItem } from '$lib/types';
	import { folderStore } from '$lib/stores/folder.svelte';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import FolderTreeItem from './FolderTreeItem.svelte';

	let {
		node,
		depth = 0,
		onAddSubfolder
	}: {
		node: FolderTreeNode;
		depth?: number;
		onAddSubfolder: (parent: FolderItem) => void;
	} = $props();

	let hasChildren = $derived(node.children.length > 0);
	let isExpanded = $derived(folderStore.isExpanded(node.id));
	let isSelected = $derived(
		folderStore.selectedFolderId === node.id && folderStore.filterMode === 'folder'
	);
	let isDragOver = $state(false);

	function handleToggle(e: MouseEvent) {
		e.stopPropagation();
		folderStore.toggleExpand(node.id);
	}

	function handleSelect() {
		folderStore.selectFolder(node.id);
	}

	function handleOpenIndex(e: MouseEvent) {
		e.stopPropagation();
		const wsId = workspaceStore.currentWorkspaceId;
		if (wsId) {
			folderStore.openFolderIndex(wsId, node.id);
		}
	}

	function handleAddClick(e: MouseEvent) {
		e.stopPropagation();
		onAddSubfolder(node);
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const rawData = e.dataTransfer?.getData('application/json');
		if (!rawData) return;

		try {
			const doc: DocumentItem = JSON.parse(rawData);
			if (doc.folder_id === node.id) return;

			const wsId = workspaceStore.currentWorkspaceId;
			if (!wsId) return;

			const updated = await folderStore.moveDocumentToFolder(wsId, doc, node.id);
			folderStore.expandFolder(node.id);

			window.dispatchEvent(
				new CustomEvent('documentmoved', {
					detail: { document: updated, targetFolderName: node.name }
				})
			);
		} catch (err) {
			console.error('Gagal memindahkan dokumen:', err);
		}
	}
</script>

<div class="select-none text-xs">
	<div
		role="group"
		style="padding-left: {depth * 12 + 8}px;"
		ondragover={(e) => {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
			isDragOver = true;
		}}
		ondragleave={() => (isDragOver = false)}
		ondrop={handleDrop}
		class="group flex items-center justify-between py-1.5 pr-2 rounded-lg transition-colors {isDragOver
			? 'bg-emerald-100 ring-2 ring-emerald-500 font-semibold'
			: isSelected
				? 'bg-emerald-50 text-emerald-900 font-semibold'
				: 'text-gray-700 hover:bg-gray-100/70 hover:text-gray-900'}"
	>
		<div class="flex items-center gap-1.5 min-w-0 flex-1">
			<!-- Expand/Collapse Chevron Button -->
			{#if hasChildren}
				<button
					type="button"
					onclick={handleToggle}
					aria-expanded={isExpanded}
					aria-label={isExpanded ? 'Tutup folder' : 'Buka folder'}
					class="w-4 h-4 shrink-0 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-transform cursor-pointer {isExpanded
						? 'rotate-90'
						: ''}"
				>
					<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</button>
			{:else}
				<span class="w-4 h-4 shrink-0 flex items-center justify-center text-gray-300">
					<span class="w-1.5 h-1.5 rounded-full bg-gray-300/80"></span>
				</span>
			{/if}

			<!-- Folder Select Button -->
			<button
				type="button"
				onclick={handleSelect}
				class="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer focus:outline-hidden"
			>
				<!-- Folder Icon -->
				<svg
					class="w-3.5 h-3.5 shrink-0 {isSelected
						? 'text-emerald-600'
						: 'text-gray-400 group-hover:text-gray-600'}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
					/>
				</svg>

				<!-- Folder Name -->
				<span class="truncate">
					{node.name}
				</span>
			</button>
		</div>

		<!-- Action buttons (Open Folder Index & Add subfolder) -->
		<div
			class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
		>
			<button
				type="button"
				onclick={handleOpenIndex}
				title="Buka Halaman Indeks (README)"
				aria-label={`Buka indeks folder ${node.name}`}
				class="w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-emerald-700 hover:bg-emerald-100/60 cursor-pointer"
			>
				<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
					/>
				</svg>
			</button>
			<button
				type="button"
				onclick={handleAddClick}
				title="Tambah subfolder"
				aria-label={`Tambah subfolder di ${node.name}`}
				class="w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-emerald-700 hover:bg-emerald-100/60 cursor-pointer"
			>
				<span class="text-xs leading-none font-bold">+</span>
			</button>
		</div>
	</div>

	<!-- Render Children Recursively -->
	{#if hasChildren && isExpanded}
		<div class="space-y-0.5 mt-0.5">
			{#each node.children as child (child.id)}
				<FolderTreeItem node={child} depth={depth + 1} {onAddSubfolder} />
			{/each}
		</div>
	{/if}
</div>
