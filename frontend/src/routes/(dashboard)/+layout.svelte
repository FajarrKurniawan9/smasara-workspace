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

<div class="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
	<!-- Sidebar -->
	<aside
		class="hidden w-64 flex-shrink-0 flex-col border-r border-zinc-200/80 bg-white/80 backdrop-blur-md md:flex"
	>
		<!-- Logo / Brand -->
		<div
			class="flex h-16 items-center justify-between border-b border-zinc-200/80 px-6 font-semibold tracking-tight text-zinc-900"
		>
			<span class="flex items-center gap-2.5">
				<span
					class="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-900 text-xs font-bold text-white shadow-input"
				>
					S
				</span>
				<span class="text-base font-semibold tracking-tight text-zinc-900">Smasara</span>
			</span>
		</div>

		<!-- Workspace Selector & Management -->
		<div class="border-b border-zinc-100 p-3 bg-zinc-50/60">
			<div class="mb-2 flex items-center justify-between px-1">
				<span class="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
					Workspace
				</span>
				<button
					type="button"
					onclick={() => (isCreateWsModalOpen = true)}
					class="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-200/60 hover:text-zinc-900 active:scale-[0.98]"
					title="Buat Workspace Baru"
				>
					<span>+</span>
					<span>Baru</span>
				</button>
			</div>

			{#if workspaceStore.workspaces.length > 0}
				<select
					bind:value={workspaceStore.currentWorkspaceId}
					class="w-full truncate rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-800 shadow-input transition-all hover:border-zinc-300 focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/5"
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
					class="w-full rounded-xl border border-dashed border-zinc-300 p-2.5 text-center text-xs font-medium text-zinc-700 transition-all hover:border-zinc-400 hover:bg-zinc-100/60 active:scale-[0.98]"
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
		<div class="border-t border-zinc-200/80 p-3">
			<button
				onclick={handleLogout}
				disabled={isLoggingOut}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100/80 px-3 py-2 text-xs font-medium text-zinc-700 transition-all hover:bg-red-50 hover:text-red-600 active:scale-[0.98] disabled:opacity-50"
			>
				{isLoggingOut ? 'Keluar...' : 'Logout'}
			</button>
		</div>
	</aside>

	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Topbar -->
		<header
			class="flex h-16 items-center justify-between border-b border-zinc-200/80 bg-white/80 px-6 backdrop-blur-md"
		>
			<div class="flex items-center md:hidden">
				<span class="text-base font-semibold tracking-tight text-zinc-900">Smasara</span>
			</div>

			<div class="hidden items-center gap-2 text-xs text-zinc-500 md:flex">
				{#if workspaceStore.currentWorkspace}
					<span class="font-medium text-zinc-800">
						{workspaceStore.currentWorkspace.name}
					</span>
					<span class="text-zinc-300">•</span>
					<span class="font-mono text-zinc-400">
						/{workspaceStore.currentWorkspace.slug}
					</span>
				{/if}
			</div>

			<div class="mx-8 hidden max-w-xl flex-1 justify-center md:flex">
				{#if workspaceStore.currentWorkspace}
					<button
						type="button"
						onclick={() => (isSearchOpen = true)}
						class="flex w-full max-w-md cursor-text items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 px-3.5 py-2 text-sm text-zinc-500 shadow-input transition-all hover:border-zinc-300 hover:bg-white active:scale-[0.99] focus:border-zinc-900 focus:outline-none focus:ring-4 focus:ring-zinc-900/5"
						title="Cari Catatan (Cmd/Ctrl + K)"
					>
						<div class="flex items-center gap-2.5">
							<svg
								class="h-4 w-4 text-zinc-400"
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
						<div class="flex shrink-0 items-center gap-1">
							<kbd
								class="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-zinc-400 shadow-2xs"
								>⌘</kbd
							>
							<kbd
								class="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-zinc-400 shadow-2xs"
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
						class="rounded-xl p-2 text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-800 active:scale-[0.98] md:hidden"
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
						class="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-input transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98]"
						title="Lihat Profil Publik"
					>
						<svg
							class="h-3.5 w-3.5 text-zinc-400"
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
					<span class="rounded-xl bg-zinc-100 px-2.5 py-1 font-mono text-xs text-zinc-500">
						{auth.userId ? auth.userId.substring(0, 8) + '...' : 'Unknown'}
					</span>
				{/if}
			</div>
		</header>

		<!-- Main Content Scrollable Area -->
		<main class="flex-1 overflow-y-auto p-6 bg-zinc-50">
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
