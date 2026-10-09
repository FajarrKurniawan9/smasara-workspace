import { fetchApi } from '$lib/api';
import type { FolderItem, FolderTreeNode, FolderDetail, DocumentItem } from '$lib/types';
import { SvelteSet } from 'svelte/reactivity';
class FolderStore {
	folders = $state<FolderItem[]>([]);
	selectedFolderId = $state<string | null>(null);
	selectedFolderDetail = $state<FolderDetail | null>(null);
	viewMode = $state<'document' | 'folder-index' | 'graph'>('document');
	filterMode = $state<'all' | 'folder' | 'uncategorized'>('all');
	expandedFolderIds = new SvelteSet<string>();
	isLoading = $state(false);
	isLoadingDetail = $state(false);
	currentWorkspaceId = $state<string>('');

	// Mengonversi flat list dari database menjadi nested tree
	tree = $derived.by<FolderTreeNode[]>(() => {
		const nodeMap: Record<string, FolderTreeNode> = {};
		const rootNodes: FolderTreeNode[] = [];

		// Buat copy setiap node dengan children kosong
		for (const folder of this.folders) {
			nodeMap[folder.id] = {
				...folder,
				children: []
			};
		}

		// Sambungkan anak ke induk sesuai parent_id
		for (const folder of this.folders) {
			const node = nodeMap[folder.id];
			if (folder.parent_id && nodeMap[folder.parent_id]) {
				nodeMap[folder.parent_id].children.push(node);
			} else {
				rootNodes.push(node);
			}
		}

		// Urutkan alfabetis
		const sortNodes = (nodes: FolderTreeNode[]) => {
			nodes.sort((a, b) => a.name.localeCompare(b.name));
			for (const node of nodes) {
				if (node.children.length > 0) {
					sortNodes(node.children);
				}
			}
		};
		sortNodes(rootNodes);

		return rootNodes;
	});

	selectedFolder = $derived.by(() => {
		if (!this.selectedFolderId) return null;
		return this.folders.find((f) => f.id === this.selectedFolderId) || null;
	});

	async loadFolders(workspaceId: string) {
		if (!workspaceId) return;
		if (this.currentWorkspaceId !== workspaceId) {
			this.selectedFolderId = null;
			this.selectedFolderDetail = null;
			this.viewMode = 'document';
			this.filterMode = 'all';
			this.expandedFolderIds.clear();
		}
		this.currentWorkspaceId = workspaceId;
		try {
			this.isLoading = true;
			const res = await fetchApi<{ message?: string; data: FolderItem[] }>(
				`/api/workspaces/${workspaceId}/folders`
			);
			this.folders = res.data || [];
		} catch (err) {
			console.error('Gagal mengambil daftar folder:', err);
			this.folders = [];
		} finally {
			this.isLoading = false;
		}
	}

	async createFolder(
		workspaceId: string,
		name: string,
		parentId?: string | null
	): Promise<FolderItem> {
		const cleanName = name.trim();
		if (!cleanName) throw new Error('Nama folder tidak boleh kosong');

		const payload: { name: string; parent_id?: string } = {
			name: cleanName
		};
		if (parentId) {
			payload.parent_id = parentId;
		}

		const res = await fetchApi<{ message: string; data: FolderItem }>(
			`/api/workspaces/${workspaceId}/folders`,
			{
				method: 'POST',
				body: JSON.stringify(payload)
			}
		);

		if (res.data) {
			this.folders = [...this.folders, res.data];
			// Otomatis expand induk jika ini adalah subfolder
			if (parentId) {
				this.expandFolder(parentId);
			}
			return res.data;
		}
		throw new Error('Gagal membuat folder');
	}

	async deleteFolder(workspaceId: string, folderId: string): Promise<void> {
		await fetchApi(`/api/workspaces/${workspaceId}/folders/${folderId}`, {
			method: 'DELETE'
		});

		this.folders = this.folders.filter((f) => f.id !== folderId && f.parent_id !== folderId);
		if (this.selectedFolderId === folderId) {
			this.selectedFolderId = null;
		}
	}

	toggleExpand(folderId: string) {
		if (this.expandedFolderIds.has(folderId)) {
			this.expandedFolderIds.delete(folderId);
		} else {
			this.expandedFolderIds.add(folderId);
		}
	}

	expandFolder(folderId: string) {
		this.expandedFolderIds.add(folderId);
	}

	isExpanded(folderId: string): boolean {
		return this.expandedFolderIds.has(folderId);
	}

	selectFolder(folderId: string | null) {
		this.selectedFolderId = folderId;
		this.filterMode = folderId ? 'folder' : 'all';
	}

	setUncategorizedFilter() {
		this.selectedFolderId = null;
		this.filterMode = 'uncategorized';
	}

	async openFolderIndex(workspaceId: string, folderId: string) {
		this.selectedFolderId = folderId;
		this.filterMode = 'folder';
		this.viewMode = 'folder-index';
		await this.loadFolderDetail(workspaceId, folderId);
	}

	openDocumentEditor() {
		this.viewMode = 'document';
	}

	openGraphView() {
		this.viewMode = 'graph';
	}

	async loadFolderDetail(workspaceId: string, folderId: string) {
		if (!workspaceId || !folderId) return;
		try {
			this.isLoadingDetail = true;
			const res = await fetchApi<FolderDetail>(
				`/api/workspaces/${workspaceId}/folders/${folderId}`
			);
			this.selectedFolderDetail = res;
		} catch (err) {
			console.error('Gagal mengambil detail folder:', err);
			this.selectedFolderDetail = null;
		} finally {
			this.isLoadingDetail = false;
		}
	}

	async setFolderIndex(
		workspaceId: string,
		folderId: string,
		documentId: string | null
	): Promise<void> {
		await fetchApi(`/api/workspaces/${workspaceId}/folders/${folderId}/index`, {
			method: 'PUT',
			body: JSON.stringify({ document_id: documentId || '' })
		});
		await this.loadFolderDetail(workspaceId, folderId);
		await this.loadFolders(workspaceId);
	}

	async moveDocumentToFolder(
		workspaceId: string,
		doc: DocumentItem,
		targetFolderId: string | null
	): Promise<DocumentItem> {
		const res = await fetchApi<{ message: string; document: DocumentItem }>(
			`/api/workspaces/${workspaceId}/documents/${doc.id}`,
			{
				method: 'PUT',
				body: JSON.stringify({
					title: doc.title,
					content: doc.content || '',
					folder_id: targetFolderId || '',
					is_public: doc.is_public,
					version: doc.version
				})
			}
		);
		return res.document;
	}
}

export const folderStore = new FolderStore();
