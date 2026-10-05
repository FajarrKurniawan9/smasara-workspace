<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import { folderStore } from '$lib/stores/folder.svelte';
	import { fetchApi } from '$lib/api';
	import { goto } from '$app/navigation';
	import CreateWorkspaceModal from '$lib/components/workspace/CreateWorkspaceModal.svelte';
	import { FolderTree } from '$lib/components/folder';
	import { SearchPalette } from '$lib/components/search';

	let { children } = $props();
	let isLoggingOut = $state(false);
	let isCreateWsModalOpen = $state(false);
	let isSearchOpen = $state(false);

	function handleSearchSelect(docId: string) {
		window.dispatchEvent(new CustomEvent('search-select', { detail: { id: docId } }));
	}

	onMount(async () => {
		await workspaceStore.loadWorkspaces();
	});

	$effect(() => {
		const wsId = workspaceStore.currentWorkspaceId;
		if (wsId) {
			folderStore.loadFolders(wsId);
		}
	});

	async function handleLogout() {
		try {
			isLoggingOut = true;
			await fetchApi('/api/logout', { method: 'POST' }).catch(() => {});
		} finally {
			auth.clearAuth();
			goto('/login');
			isLoggingOut = false;
		}
	}

	async function handleCreateWorkspace(name: string) {
		await workspaceStore.createWorkspace(name);
	}
</script>

<div class="flex h-screen overflow-hidden bg-gray-50">
	<!-- Sidebar -->
	<aside
		class="w-64 flex-shrink-0 border-r border-gray-200 bg-white shadow-sm flex flex-col hidden md:flex"
	>
		<!-- Logo / Brand -->
		<div
			class="flex h-16 items-center justify-between border-b border-gray-200 px-6 font-bold text-gray-800 text-lg"
		>
			<span class="flex items-center gap-2">
				<span class="text-emerald-600">Smasara</span>
			</span>
		</div>

		<!-- Workspace Selector & Management -->
		<div class="border-b border-gray-100 p-3 bg-gray-50/50">
			<div class="flex items-center justify-between mb-1.5 px-1">
				<span class="text-[11px] font-bold uppercase tracking-wider text-gray-400">
					Workspace
				</span>
				<button
					type="button"
					onclick={() => (isCreateWsModalOpen = true)}
					class="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 hover:underline"
					title="Buat Workspace Baru"
				>
					<span>+</span>
					<span>Baru</span>
				</button>
			</div>

			{#if workspaceStore.workspaces.length > 0}
				<select
					bind:value={workspaceStore.currentWorkspaceId}
					class="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-2xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
				>
					{#each workspaceStore.workspaces as ws (ws.id)}
						<option value={ws.id}>
							{ws.name}
							{ws.role ? `(${ws.role})` : ''}
						</option>
					{/each}
				</select>
			{:else}
				<button
					type="button"
					onclick={() => (isCreateWsModalOpen = true)}
					class="w-full rounded-lg border border-dashed border-gray-300 p-2 text-center text-xs text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
				>
					+ Buat Workspace Pertama
				</button>
			{/if}
		</div>

		<!-- Folders / Navigasi Sidebar (T-401) -->
		<div class="flex-1 overflow-y-auto px-3 py-2">
			<FolderTree />
		</div>

		<!-- Logout Button -->
		<div class="border-t border-gray-200 p-4">
			<button
				onclick={handleLogout}
				disabled={isLoggingOut}
				class="w-full rounded-lg bg-red-50 text-red-600 px-4 py-2 text-xs text-center font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
			>
				{isLoggingOut ? 'Keluar...' : 'Logout'}
			</button>
		</div>
	</aside>

	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Topbar -->
		<header
			class="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 shadow-xs"
		>
			<div class="flex items-center md:hidden">
				<span class="font-bold text-gray-800 text-lg">Smasara</span>
			</div>

			<div class="hidden md:flex items-center gap-2 text-xs text-gray-500">
				{#if workspaceStore.currentWorkspace}
					<span class="font-medium text-gray-700">
						{workspaceStore.currentWorkspace.name}
					</span>
					<span>•</span>
					<span class="font-mono text-gray-400">
						/{workspaceStore.currentWorkspace.slug}
					</span>
				{/if}
			</div>

			<div class="flex-1 flex justify-center max-w-xl mx-8 hidden md:flex">
				{#if workspaceStore.currentWorkspace}
					<button
						type="button"
						onclick={() => (isSearchOpen = true)}
						class="flex w-full max-w-md items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-text shadow-2xs"
						title="Cari Catatan (Cmd/Ctrl + K)"
					>
						<div class="flex items-center gap-2">
							<svg
								class="h-4 w-4 text-gray-400"
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
							<span class="truncate">Cari di {workspaceStore.currentWorkspace.name}...</span>
						</div>
						<div class="flex items-center gap-1 shrink-0">
							<kbd
								class="font-sans font-semibold text-[10px] bg-white border border-gray-200 text-gray-400 px-1.5 rounded shadow-sm"
								>⌘</kbd
							>
							<kbd
								class="font-sans font-semibold text-[10px] bg-white border border-gray-200 text-gray-400 px-1.5 rounded shadow-sm"
								>K</kbd
							>
						</div>
					</button>
				{/if}
			</div>

			<div class="flex items-center space-x-2">
				{#if workspaceStore.currentWorkspace}
					<button
						type="button"
						onclick={() => (isSearchOpen = true)}
						class="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						title="Cari Catatan"
						aria-label="Cari Catatan"
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
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</button>
				{/if}
				{#if auth.username}
					<a
						href="/@{auth.username}"
						class="text-xs font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
						title="Lihat Profil Publik"
					>
						<svg
							class="w-3.5 h-3.5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
							></path>
						</svg>
						<span>@{auth.username}</span>
					</a>
				{:else}
					<span class="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
						{auth.userId ? auth.userId.substring(0, 8) + '...' : 'Unknown'}
					</span>
				{/if}
			</div>
		</header>

		<!-- Main Content Scrollable Area -->
		<main class="flex-1 overflow-y-auto p-6 bg-gray-50">
			{@render children()}
		</main>
	</div>
</div>

<!-- Modal Pembuatan Workspace Baru -->
<CreateWorkspaceModal
	isOpen={isCreateWsModalOpen}
	onClose={() => (isCreateWsModalOpen = false)}
	onCreate={handleCreateWorkspace}
/>

<SearchPalette bind:isOpen={isSearchOpen} onSelect={handleSearchSelect} />
