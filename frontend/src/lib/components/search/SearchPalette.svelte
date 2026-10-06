<script lang="ts">
	import { fetchApi } from '$lib/api';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import type { SearchDocumentItem } from '$lib/types';
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';

	let {
		isOpen = $bindable(false),
		onSelect
	}: {
		isOpen: boolean;
		onSelect: (docId: string) => void;
	} = $props();

	let searchQuery = $state('');
	let results = $state<SearchDocumentItem[]>([]);
	let isLoading = $state(false);
	let selectedIndex = $state(0);

	let searchInput: HTMLInputElement | undefined = $state();

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let searchRequestId = 0;

	$effect(() => {
		if (isOpen) {
			searchQuery = '';
			results = [];
			isLoading = false;
			selectedIndex = 0;
			// Use setTimeout to ensure the element is in DOM before focusing
			setTimeout(() => {
				if (searchInput) searchInput.focus();
			}, 50);
		} else {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = undefined;
			}
			isLoading = false;
		}
	});

	async function performSearch(query: string) {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || !query.trim()) {
			results = [];
			isLoading = false;
			return;
		}

		const currentId = ++searchRequestId;
		isLoading = true;
		try {
			const res = await fetchApi<{ results: SearchDocumentItem[] }>(
				`/api/workspaces/${wsId}/search?q=${encodeURIComponent(query)}`
			);
			if (currentId !== searchRequestId) return;
			results = res.results || [];
			selectedIndex = 0; // reset selection
		} catch (err) {
			if (currentId !== searchRequestId) return;
			console.error('Search failed', err);
			results = [];
		} finally {
			if (currentId === searchRequestId) {
				isLoading = false;
			}
		}
	}

	function handleInput() {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
		if (!searchQuery.trim()) {
			results = [];
			isLoading = false;
			return;
		}
		isLoading = true;
		debounceTimer = setTimeout(() => {
			performSearch(searchQuery);
		}, 300);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) return;

		if (e.key === 'Escape') {
			e.preventDefault();
			isOpen = false;
			return;
		}

		if (results.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedIndex = (selectedIndex + 1) % results.length;
				scrollToSelected();
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedIndex = (selectedIndex - 1 + results.length) % results.length;
				scrollToSelected();
			} else if (e.key === 'Enter') {
				e.preventDefault();
				if (results[selectedIndex]) {
					selectDocument(results[selectedIndex]);
				}
			}
		}
	}

	function scrollToSelected() {
		setTimeout(() => {
			const activeEl = document.getElementById(`search-item-${selectedIndex}`);
			if (activeEl) {
				activeEl.scrollIntoView({ block: 'nearest' });
			}
		}, 0);
	}

	function selectDocument(doc?: SearchDocumentItem) {
		if (!doc) return;
		isOpen = false;
		onSelect(doc.id);
	}

	onMount(() => {
		const handleGlobalKeydown = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				isOpen = !isOpen;
			}
		};
		window.addEventListener('keydown', handleGlobalKeydown);
		return () => window.removeEventListener('keydown', handleGlobalKeydown);
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4"
		role="dialog"
		aria-modal="true"
		aria-label="Pencarian Catatan"
	>
		<!-- Backdrop -->
		<div
			class="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm transition-opacity"
			aria-hidden="true"
			onclick={() => (isOpen = false)}
			transition:fade={{ duration: 150 }}
		></div>

		<!-- Command Palette Panel -->
		<div
			class="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-zinc-900/5"
			transition:slide={{ duration: 200, axis: 'y' }}
		>
			<div class="flex items-center border-b border-zinc-100 px-4">
				<svg
					class="h-5 w-5 text-zinc-400"
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
				<input
					bind:this={searchInput}
					bind:value={searchQuery}
					oninput={handleInput}
					type="text"
					class="w-full border-0 bg-transparent py-4 pl-3 pr-4 text-base text-zinc-900 placeholder-zinc-400 outline-none focus:ring-0"
					placeholder="Cari catatan... (judul atau konten)"
					autocomplete="off"
				/>
				<!-- Loading indicator or Cmd+K tip -->
				{#if isLoading}
					<span class="flex h-4 w-4 shrink-0">
						<span
							class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"
						></span>
					</span>
				{:else}
					<span
						class="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 shadow-2xs"
					>
						ESC
					</span>
				{/if}
			</div>

			<div class="max-h-[60vh] overscroll-contain overflow-y-auto p-2">
				{#if searchQuery.trim() === ''}
					<div class="px-6 py-12 text-center">
						<p class="text-sm text-zinc-500">Mulai mengetik untuk mencari catatan.</p>
					</div>
				{:else if results.length === 0 && !isLoading}
					<div class="px-6 py-12 text-center">
						<p class="text-sm text-zinc-500">
							Tidak ada catatan yang cocok dengan "{searchQuery}".
						</p>
					</div>
				{:else}
					<div class="space-y-1 text-sm text-zinc-700" role="listbox">
						{#each results as doc, i (doc.id)}
							<button
								type="button"
								id="search-item-{i}"
								role="option"
								aria-selected={i === selectedIndex}
								class="flex w-full cursor-default select-none flex-col gap-1 rounded-xl px-4 py-3 text-left transition-all {i ===
								selectedIndex
									? 'bg-zinc-100 text-zinc-900'
									: 'text-zinc-700 hover:bg-zinc-50'}"
								onmousemove={() => (selectedIndex = i)}
								onclick={() => selectDocument(doc)}
							>
								<div class="flex items-start justify-between gap-3">
									<div class="flex min-w-0 items-center gap-2">
										<svg
											class="h-4 w-4 shrink-0 {i === selectedIndex
												? 'text-zinc-900'
												: 'text-zinc-400'}"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
											/>
										</svg>
										<span
											class="font-medium truncate {i === selectedIndex
												? 'text-zinc-900 font-semibold'
												: 'text-zinc-800'}"
										>
											{doc.title}
										</span>
									</div>
									{#if doc.is_public}
										<span
											class="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
										>
											Publik
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-3 pl-6">
									<span
										class="truncate font-mono text-xs {i === selectedIndex
											? 'text-zinc-600'
											: 'text-zinc-400'}"
									>
										[[{doc.slug}]]
									</span>
									<span
										class="text-[10px] {i === selectedIndex ? 'text-zinc-500' : 'text-zinc-400'}"
									>
										Update: {new Date(doc.updated_at).toLocaleDateString('id-ID')}
									</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div
				class="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-4 py-3 text-xs text-zinc-500"
			>
				<div class="flex items-center gap-3">
					<span class="flex items-center gap-1">
						<kbd
							class="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-zinc-400 shadow-2xs"
							>↑</kbd
						>
						<kbd
							class="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-zinc-400 shadow-2xs"
							>↓</kbd
						>
						Navigasi
					</span>
					<span class="flex items-center gap-1">
						<kbd
							class="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-zinc-400 shadow-2xs"
							>↵</kbd
						>
						Pilih
					</span>
				</div>
				<span class="flex items-center gap-1">
					<kbd
						class="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-zinc-400 shadow-2xs"
						>ESC</kbd
					>
					Tutup
				</span>
			</div>
		</div>
	</div>
{/if}
