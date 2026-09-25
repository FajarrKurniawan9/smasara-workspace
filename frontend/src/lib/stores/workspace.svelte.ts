import { fetchApi } from '$lib/api';
import type { WorkspaceItem } from '$lib/types';

class WorkspaceStore {
	workspaces = $state<WorkspaceItem[]>([]);
	currentWorkspaceId = $state<string>('');
	isLoading = $state(false);

	currentWorkspace = $derived.by(() => {
		return this.workspaces.find((w) => w.id === this.currentWorkspaceId) || null;
	});

	async loadWorkspaces() {
		try {
			this.isLoading = true;
			const res = await fetchApi<{ workspaces: WorkspaceItem[] }>('/api/workspaces');
			this.workspaces = res.workspaces || [];

			if (this.workspaces.length > 0) {
				if (
					!this.currentWorkspaceId ||
					!this.workspaces.some((w) => w.id === this.currentWorkspaceId)
				) {
					this.currentWorkspaceId = this.workspaces[0].id;
				}
			}
		} catch (err) {
			console.error('Gagal mengambil daftar workspace:', err);
		} finally {
			this.isLoading = false;
		}
	}

	async createWorkspace(name: string, slug?: string): Promise<WorkspaceItem> {
		const cleanName = name.trim();
		const rawSlug =
			slug?.trim() ||
			cleanName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '');
		const cleanSlug = `${rawSlug}-${Date.now().toString().slice(-4)}`;

		const res = await fetchApi<{ workspace: WorkspaceItem }>('/api/workspaces', {
			method: 'POST',
			body: JSON.stringify({
				name: cleanName,
				slug: cleanSlug
			})
		});

		if (res.workspace) {
			this.workspaces = [...this.workspaces, res.workspace];
			this.currentWorkspaceId = res.workspace.id;
			return res.workspace;
		}
		throw new Error('Gagal membuat workspace');
	}
}

export const workspaceStore = new WorkspaceStore();
