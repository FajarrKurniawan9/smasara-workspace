import { fetchApi } from '$lib/api';
import type { WorkspaceItem, WorkspaceMemberItem } from '$lib/types';

class WorkspaceStore {
	workspaces = $state<WorkspaceItem[]>([]);
	currentWorkspaceId = $state<string>('');
	isLoading = $state(false);
	members = $state<WorkspaceMemberItem[]>([]);
	isLoadingMembers = $state(false);

	currentWorkspace = $derived.by(() => {
		return this.workspaces.find((w) => w.id === this.currentWorkspaceId) || null;
	});

	memberCount = $derived.by(() => {
		const currentId = this.currentWorkspaceId;
		const matchingMembers = this.members.filter((m) => m.workspace_id === currentId);
		if (matchingMembers.length > 0) return matchingMembers.length;
		return this.currentWorkspace?.member_count ?? 1;
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

	async loadMembers(workspaceId?: string) {
		const targetId = workspaceId || this.currentWorkspaceId;
		if (!targetId) return;
		try {
			this.isLoadingMembers = true;
			const res = await fetchApi<{ members: WorkspaceMemberItem[] }>(
				`/api/workspaces/${targetId}/members`
			);
			if (this.currentWorkspaceId === targetId) {
				this.members = res.members || [];
			}
		} catch {
			this.isLoadingMembers = false;
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
