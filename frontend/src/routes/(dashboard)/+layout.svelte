<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import { folderStore } from '$lib/stores/folder.svelte';
	import { fetchApi } from '$lib/api';
	import { goto } from '$app/navigation';
	import CreateWorkspaceModal from '$lib/components/workspace/CreateWorkspaceModal.svelte';
	import { FolderTree } from '$lib/components/folder';
	import { CommandPalette } from '$lib/components/command';
	import { SearchPalette } from '$lib/components/search';
	import { Breadcrumbs } from '$lib/components/ui';
	import { ThemeSettingsModal } from '$lib/components/common';
	import { themeStore } from '$lib/stores/theme.svelte';

	let { children } = $props();
	let isLoggingOut = $state(false);
	let isCreateWsModalOpen = $state(false);
	let isSearchOpen = $state(false);
	let isThemeModalOpen = $state(false);

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

<div class="flex h-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
	<!-- Sidebar -->
	<aside
		class="hidden w-64 flex-shrink-0 flex-col border-r border-[var(--border-app)] bg-[var(--bg-surface)] backdrop-blur-md md:flex"
	>
		<!-- Logo / Brand -->
		<div
			class="flex h-16 items-center justify-between border-b border-[var(--border-app)] px-6 font-semibold tracking-tight text-[var(--text-primary)]"
		>
			<span class="flex items-center gap-2.5">
				<span
					class="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-input dark:bg-zinc-100 dark:text-zinc-900"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
						/>
					</svg>
				</span>
				<span class="text-base font-semibold tracking-tight text-[var(--text-primary)]"
					>Smasara</span
				>
			</span>
		</div>

		<!-- Workspace Selector & Management -->
		<div class="border-b border-[var(--border-app-subtle)] p-3 bg-[var(--bg-surface-subtle)]">
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
					class="w-full truncate rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] shadow-input transition-all hover:border-zinc-400 focus:outline-none focus:ring-4 focus:ring-zinc-900/5 dark:focus:ring-zinc-100/5"
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
		<div class="border-t border-[var(--border-app)] p-3 space-y-2">
			<button
				type="button"
				onclick={() => (isThemeModalOpen = true)}
				class="flex w-full items-center justify-between rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-zinc-400 hover:text-[var(--text-primary)] active:scale-[0.98]"
				title="Atur Tema & Tipografi"
				data-testid="theme-settings-sidebar-btn"
			>
				<span class="flex items-center gap-2">
					{#if themeStore.mode === 'dark'}
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.75"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
							/>
						</svg>
					{:else if themeStore.mode === 'normal'}
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.75"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
							/>
						</svg>
					{:else}
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.75"
						>
							<circle cx="12" cy="12" r="4" stroke-linecap="round" stroke-linejoin="round" />
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
							/>
						</svg>
					{/if}
					<span>Tema & Font</span>
				</span>
				<span class="text-[10px] uppercase font-semibold opacity-60">
					{themeStore.mode}
				</span>
			</button>
			<button
				onclick={handleLogout}
				disabled={isLoggingOut}
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--bg-surface-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition-all hover:bg-red-500/10 hover:text-red-500 active:scale-[0.98] disabled:opacity-50"
			>
				{isLoggingOut ? 'Keluar...' : 'Logout'}
			</button>
		</div>
	</aside>

	<!-- Main Content Area -->
	<div class="flex flex-1 flex-col overflow-hidden">
		<!-- Topbar -->
		<header
			class="flex h-16 items-center justify-between border-b border-[var(--border-app)] bg-[var(--bg-surface)] px-6 backdrop-blur-md"
		>
			<div class="flex items-center md:hidden">
				<span class="text-base font-semibold tracking-tight text-[var(--text-primary)]"
					>Smasara</span
				>
			</div>
 <Breadcrumbs
	path={folderStore.breadcrumbPath}
 />

			<div class="mx-8 hidden max-w-xl flex-1 justify-center md:flex">
				{#if workspaceStore.currentWorkspace}
					<button
						type="button"
						onclick={() => (isSearchOpen = true)}
						class="flex w-full max-w-md cursor-text items-center justify-between rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-sm text-[var(--text-secondary)] shadow-input transition-all hover:border-zinc-400 hover:text-[var(--text-primary)] active:scale-[0.99]"
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
						onclick={() => folderStore.openGraphView()}
						class="flex items-center gap-1.5 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-input transition-all hover:border-zinc-400 hover:text-[var(--text-primary)] active:scale-[0.98]"
						title="Buka Graf Relasi Workspace"
						aria-label="Buka Graf Relasi Workspace"
						data-testid="workspace-graph-btn"
					>
						<svg
							class="h-3.5 w-3.5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.75"
						>
							<circle cx="6" cy="6" r="2.5" />
							<circle cx="18" cy="8" r="2.5" />
							<circle cx="12" cy="18" r="2.5" />
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M8.2 7.2l7.6 1.6M7.2 8.2l3.6 7.6M16.8 9.8l-3.6 6"
							/>
						</svg>
						<span class="hidden sm:inline">Graf</span>
					</button>
				{/if}
				<button
					type="button"
					onclick={() => (isThemeModalOpen = true)}
					class="flex items-center gap-1.5 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-input transition-all hover:border-zinc-400 hover:text-[var(--text-primary)] active:scale-[0.98]"
					title="Pengaturan Tema & Tipografi"
					aria-label="Pengaturan Tema & Tipografi"
					data-testid="theme-settings-header-btn"
				>
					{#if themeStore.mode === 'dark'}
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.75"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
							/>
						</svg>
					{:else if themeStore.mode === 'normal'}
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.75"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
							/>
						</svg>
					{:else}
						<svg
							class="h-4 w-4"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.75"
						>
							<circle cx="12" cy="12" r="4" stroke-linecap="round" stroke-linejoin="round" />
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
							/>
						</svg>
					{/if}
				</button>
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
						class="flex items-center gap-1.5 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-input transition-all hover:border-zinc-400 hover:text-[var(--text-primary)] active:scale-[0.98]"
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
		<main class="flex-1 overflow-y-auto p-6 bg-[var(--bg-app)]">
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

 <CommandPalette bind:isOpen={isSearchOpen}>
 	<SearchPalette bind:isOpen={isSearchOpen} onSelect={handleSearchSelect} />
 </CommandPalette>

<ThemeSettingsModal isOpen={isThemeModalOpen} onClose={() => (isThemeModalOpen = false)} />
