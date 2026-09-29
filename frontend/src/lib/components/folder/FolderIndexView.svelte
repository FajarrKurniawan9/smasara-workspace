<script lang="ts">
	import { folderStore } from '$lib/stores/folder.svelte';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import type { DocumentItem } from '$lib/types';

	let {
		documents = [],
		onSelectDocument,
		onCreateDocument
	}: {
		documents: DocumentItem[];
		onSelectDocument: (doc: DocumentItem) => void;
		onCreateDocument: () => void;
	} = $props();

	let folder = $derived(folderStore.selectedFolderDetail?.folder || folderStore.selectedFolder);
	let indexDoc = $derived(folderStore.selectedFolderDetail?.index_document);
	let isSettingIndex = $state(false);
	let selectedDocForIndex = $state('');

	// Dokumen-dokumen yang menjadi anggota folder ini
	let folderDocs = $derived(documents.filter((d) => folder && d.folder_id === folder.id));

	async function handleSetIndex() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || !folder || !selectedDocForIndex) return;
		try {
			await folderStore.setFolderIndex(wsId, folder.id, selectedDocForIndex);
			isSettingIndex = false;
			selectedDocForIndex = '';
		} catch (err) {
			console.error('Gagal menetapkan dokumen indeks:', err);
			alert('Gagal menetapkan dokumen indeks folder');
		}
	}

	async function handleClearIndex() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || !folder) return;
		if (!confirm('Yakin ingin melepas dokumen indeks folder ini?')) return;
		try {
			await folderStore.setFolderIndex(wsId, folder.id, null);
		} catch (err) {
			console.error('Gagal melepas dokumen indeks:', err);
		}
	}

	async function handleCreateReadme() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!wsId || !folder) return;
		onCreateDocument();
	}
</script>

<div class="h-full flex flex-col overflow-y-auto p-8 max-w-5xl mx-auto space-y-8">
	<!-- Folder Breadcrumb & Header -->
	<div class="flex items-center justify-between pb-4 border-b border-gray-200">
		<div class="flex items-center gap-2">
			<span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Folder</span>
			<span class="text-gray-300">/</span>
			<h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
				<svg class="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
					/>
				</svg>
				{folder?.name || 'Folder'}
			</h1>
		</div>

		<button
			type="button"
			onclick={() => folderStore.openDocumentEditor()}
			class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 shadow-2xs transition-colors cursor-pointer"
		>
			<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			<span>Kembali ke Editor</span>
		</button>
	</div>

	<!-- Section 1: Folder README (Index Document) -->
	<section class="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
		<div class="flex items-center justify-between pb-3 border-b border-gray-100">
			<div class="flex items-center gap-2">
				<span
					class="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5"
				>
					<svg
						class="w-4 h-4 text-emerald-600"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
						/>
					</svg>
					README / Dokumen Indeks
				</span>
				{#if indexDoc}
					<span class="text-[11px] font-mono text-gray-400">[[{indexDoc.slug}]]</span>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				{#if indexDoc}
					<button
						type="button"
						onclick={() => {
							const target = documents.find((d) => d.id === indexDoc?.id);
							if (target) {
								folderStore.openDocumentEditor();
								onSelectDocument(target);
							}
						}}
						class="text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
					>
						Edit Catatan Indeks
					</button>
					<span class="text-gray-300">•</span>
					<button
						type="button"
						onclick={handleClearIndex}
						class="text-xs font-medium text-red-500 hover:text-red-700 hover:underline cursor-pointer"
					>
						Lepas Indeks
					</button>
				{:else}
					<button
						type="button"
						onclick={() => (isSettingIndex = !isSettingIndex)}
						class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
					>
						<span>+</span>
						<span>{isSettingIndex ? 'Tutup Pilihan' : 'Pilih Catatan sebagai Indeks'}</span>
					</button>
				{/if}
			</div>
		</div>

		<!-- Dialog Inline Pemilihan Indeks -->
		{#if isSettingIndex && !indexDoc}
			<div class="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
				<p class="text-xs font-medium text-gray-700">Pilih catatan yang ada di folder ini:</p>
				<div class="flex items-center gap-2">
					<select
						bind:value={selectedDocForIndex}
						class="flex-1 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 focus:border-emerald-500 focus:outline-none"
					>
						<option value="">-- Pilih Catatan --</option>
						{#each folderDocs as d (d.id)}
							<option value={d.id}>{d.title} ([[{d.slug}]])</option>
						{/each}
					</select>
					<button
						type="button"
						onclick={handleSetIndex}
						disabled={!selectedDocForIndex}
						class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
					>
						Pasang
					</button>
				</div>
			</div>
		{/if}

		<!-- Konten Indeks -->
		{#if folderStore.isLoadingDetail}
			<div class="py-12 text-center text-xs text-gray-400 animate-pulse">
				Memuat indeks folder...
			</div>
		{:else if indexDoc}
			<div class="space-y-2">
				<h2 class="text-lg font-bold text-gray-900">{indexDoc.title}</h2>
				<div
					class="prose prose-sm max-w-none text-gray-700 bg-gray-50/50 p-4 rounded-lg border border-gray-100 whitespace-pre-wrap font-sans text-xs leading-relaxed"
				>
					{indexDoc.content || 'Catatan ini belum memiliki isi konten.'}
				</div>
			</div>
		{:else}
			<div class="py-8 text-center border-2 border-dashed border-gray-200 rounded-lg space-y-3">
				<p class="text-xs text-gray-500">
					Folder ini belum memiliki dokumen indeks (README pengantar).
				</p>
				<div class="flex items-center justify-center gap-3">
					<button
						type="button"
						onclick={handleCreateReadme}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-2xs transition-colors cursor-pointer"
					>
						<span>+</span>
						<span>Buat Catatan Baru di Folder Ini</span>
					</button>
				</div>
			</div>
		{/if}
	</section>

	<!-- Section 2: Daftar Catatan Anggota Folder -->
	<section class="space-y-4">
		<div class="flex items-center justify-between">
			<h2 class="text-xs font-bold text-gray-800 uppercase tracking-wider">
				Daftar Catatan dalam Folder ({folderDocs.length})
			</h2>
			<button
				type="button"
				onclick={onCreateDocument}
				class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
			>
				<span>+</span>
				<span>Catatan Baru</span>
			</button>
		</div>

		{#if folderDocs.length === 0}
			<div class="p-6 rounded-xl border border-gray-200 bg-white text-center text-xs text-gray-400">
				Belum ada catatan di dalam folder ini.
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{#each folderDocs as doc (doc.id)}
					<button
						type="button"
						onclick={() => {
							folderStore.openDocumentEditor();
							onSelectDocument(doc);
						}}
						class="text-left rounded-xl border border-gray-200 bg-white p-4 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between gap-3 group cursor-pointer"
					>
						<div class="space-y-1">
							<div class="flex items-start justify-between gap-2">
								<h3
									class="text-sm font-semibold text-gray-800 group-hover:text-emerald-800 line-clamp-1"
								>
									{doc.title}
								</h3>
								{#if doc.id === indexDoc?.id}
									<span
										class="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold shrink-0"
									>
										INDEX
									</span>
								{/if}
							</div>
							<p class="text-xs text-gray-400 font-mono">[[{doc.slug}]]</p>
						</div>

						<div
							class="flex items-center justify-between text-[11px] text-gray-400 pt-2 border-t border-gray-100"
						>
							<span>v{doc.version}</span>
							<span>{new Date(doc.updated_at).toLocaleDateString('id-ID')}</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</section>
</div>
