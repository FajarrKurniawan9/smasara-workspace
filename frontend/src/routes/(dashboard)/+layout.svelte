<script lang="ts">
	import { onMount } from 'svelte';
	import { auth } from '$lib/stores/auth.svelte';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import { fetchApi } from '$lib/api';
	import { goto } from '$app/navigation';
	import CreateWorkspaceModal from '$lib/components/workspace/CreateWorkspaceModal.svelte';

	let { children } = $props();
	let isLoggingOut = $state(false);
	let isCreateWsModalOpen = $state(false);

	onMount(async () => {
		await workspaceStore.loadWorkspaces();
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

		<!-- Folders / Navigasi Sidebar -->
		<div class="flex-1 overflow-y-auto p-4">
			<nav class="space-y-1">
				<div class="pt-2 pb-2">
					<p class="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Folders</p>
					<!-- Placeholder for Nested Folders (Fase 4: T-401) -->
					<div class="mt-2 space-y-1 pl-1">
						<button
							class="w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
						>
							<span>Uncategorized</span>
						</button>
					</div>
				</div>
			</nav>
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

			<div class="flex items-center space-x-4">
				<span class="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded">
					user: {auth.userId ? auth.userId.substring(0, 8) + '...' : 'Unknown'}
				</span>
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
