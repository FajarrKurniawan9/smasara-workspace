<script lang="ts">
	import { fetchApi, ApiError } from '$lib/api';
	import { auth } from '$lib/stores/auth.svelte';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import { folderStore } from '$lib/stores/folder.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import type { DocumentItem } from '$lib/types';
	import { getDocumentStatus } from '$lib/types';
	import MarkdownEditor from '$lib/components/editor/MarkdownEditor.svelte';
	import ConflictModal from '$lib/components/editor/ConflictModal.svelte';
	import { FolderIndexView } from '$lib/components/folder';
	import { DocumentStatusBadge, RelatedNotesPanel } from '$lib/components/document';
	import { WorkspaceGraphView } from '$lib/components/graph';
	import type { RelatedNoteItem } from '$lib/types';
	let documents: DocumentItem[] = $state([]);
	let selectedDocId = $state<string | null>(null);
	let isLoadingDocuments = $state(false);

	let filteredDocuments = $derived.by(() => {
		if (folderStore.filterMode === 'uncategorized') {
			return documents.filter((d) => !d.folder_id);
		}
		if (folderStore.filterMode === 'folder' && folderStore.selectedFolderId) {
			return documents.filter((d) => d.folder_id === folderStore.selectedFolderId);
		}
		return documents;
	});
	// Status Dokumen yang sedang diedit
	let currentDoc = $state<DocumentItem | null>(null);
	let editorTitle = $state('');
	let editorContent = $state('');
	let isPublic = $state(false);
	let isSaving = $state(false);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let statusMessage = $state('');

	// Catatan Terkait (T-602)
	let relatedNotes = $state<RelatedNoteItem[]>([]);
	let isRelatedLoading = $state(false);
	let relatedRequestId = 0;

	let currentDocStatus = $derived.by(() => {
		const doc = currentDoc;
		if (!doc) return 'private';
		const isIndex = folderStore.folders.some((f) => f.index_document_id === doc.id);
		return getDocumentStatus(doc, {
			memberCount: workspaceStore.memberCount,
			isIndexDocument: isIndex
		});
	});

	// Konflik Optimistic Locking (HTTP 409)
	let isConflictOpen = $state(false);
	let serverDocContent = $state('');
	let serverDocVersion = $state(0);

	let editorInstance: MarkdownEditor | undefined = $state();

	// Debounce auto-save
	let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;

	// Ketika workspace yang dipilih berubah di layout/store, reload dokumennya & anggotanya
	$effect(() => {
		const wsId = workspaceStore.currentWorkspaceId;
		if (wsId) {
			loadDocuments(wsId);
			workspaceStore.loadMembers(wsId);
		} else {
			documents = [];
			currentDoc = null;
			selectedDocId = null;
		}
	});

	// Sinkronisasi dokumen aktif saat folder filter berubah
	$effect(() => {
		void folderStore.selectedFolderId;
		if (filteredDocuments.length > 0) {
			if (!selectedDocId || !filteredDocuments.some((d) => d.id === selectedDocId)) {
				selectDocument(filteredDocuments[0]);
			}
		} else {
			if (currentDoc) {
				currentDoc = null;
				selectedDocId = null;
				editorTitle = '';
				editorContent = '';
			}
		}
	});

	// Listener untuk pemindahan dokumen via drag-and-drop
	$effect(() => {
		const handleMoved = (e: Event) => {
			const custom = e as CustomEvent<{ document: DocumentItem; targetFolderName: string }>;
			const updated = custom.detail.document;
			documents = documents.map((d) => (d.id === updated.id ? updated : d));
			statusMessage = `Catatan dipindahkan ke ${custom.detail.targetFolderName}`;
			saveStatus = 'saved';
		};
		window.addEventListener('documentmoved', handleMoved);
		return () => {
			window.removeEventListener('documentmoved', handleMoved);
		};
	});

	// Listener untuk pencarian (SearchPalette)
	$effect(() => {
		const handleSearch = async (e: Event) => {
			const custom = e as CustomEvent<{ id: string }>;
			const targetId = custom.detail.id;
			const targetDoc = documents.find((d) => d.id === targetId);
			if (targetDoc) {
				folderStore.openDocumentEditor();
				selectDocument(targetDoc);
			} else {
				const wsId = workspaceStore.currentWorkspaceId;
				if (wsId) {
					try {
						const res = await fetchApi<{ document: DocumentItem }>(
							`/api/workspaces/${wsId}/documents/${targetId}`
						);
						if (res.document) {
							documents = [res.document, ...documents.filter((d) => d.id !== res.document.id)];
							folderStore.openDocumentEditor();
							selectDocument(res.document);
						}
					} catch (err) {
						console.error('Gagal mengambil detail dokumen terpilih:', err);
					}
				}
			}
		};
		window.addEventListener('search-select', handleSearch);
		return () => {
			window.removeEventListener('search-select', handleSearch);
		};
	});

	async function loadDocuments(workspaceId: string) {
		isLoadingDocuments = true;
		try {
			const res = await fetchApi<{ documents: DocumentItem[] }>(
				`/api/workspaces/${workspaceId}/documents`
			);
			documents = res.documents || [];
			if (documents.length > 0) {
				if (!selectedDocId || !documents.some((d) => d.id === selectedDocId)) {
					selectDocument(documents[0]);
				}
			} else {
				currentDoc = null;
				selectedDocId = null;
			}
		} catch (err: unknown) {
			console.error('Gagal mengambil daftar dokumen:', err);
			const msg = err instanceof Error ? err.message : 'Gagal mengambil daftar dokumen';
			toast.error(msg);
		} finally {
			isLoadingDocuments = false;
		}
	}

	async function loadRelatedNotes(docId: string, wsId: string) {
		const reqId = ++relatedRequestId;
		isRelatedLoading = true;
		try {
			const res = await fetchApi<{ related: RelatedNoteItem[] }>(
				`/api/workspaces/${wsId}/documents/${docId}/related`
			);
			if (reqId !== relatedRequestId) return;
			relatedNotes = res.related || [];
		} catch (err) {
			if (reqId !== relatedRequestId) return;
			console.error('Gagal mengambil catatan terkait:', err);
			relatedNotes = [];
		} finally {
			if (reqId === relatedRequestId) {
				isRelatedLoading = false;
			}
		}
	}

	function selectDocument(doc: DocumentItem) {
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = undefined;
			if (currentDoc && currentDoc.id !== doc.id && saveStatus !== 'saved') {
				// Flush save for previous document immediately with its own content snapshot
				const prevDoc = currentDoc;
				const prevTitle = editorTitle;
				const prevContent = editorContent;
				const wsId = workspaceStore.currentWorkspaceId;
				if (wsId) {
					fetchApi<{ message: string; document: DocumentItem }>(
						`/api/workspaces/${wsId}/documents/${prevDoc.id}`,
						{
							method: 'PUT',
							body: JSON.stringify({
								title: prevTitle,
								content: prevContent,
								folder_id: prevDoc.folder_id || undefined,
								is_public: prevDoc.is_public,
								version: prevDoc.version
							})
						}
					)
						.then((res) => {
							documents = documents.map((d) => (d.id === res.document.id ? res.document : d));
						})
						.catch((err) => {
							console.error('Gagal menyimpan dokumen sebelumnya saat switch:', err);
						});
				}
			}
		}
		selectedDocId = doc.id;
		currentDoc = doc;
		editorTitle = doc.title;
		editorContent = doc.content || '';
		isPublic = doc.is_public;
		saveStatus = 'idle';
		statusMessage = '';

		const currentWsId = workspaceStore.currentWorkspaceId;
		if (currentWsId && doc.id) {
			loadRelatedNotes(doc.id, currentWsId);
		} else {
			relatedRequestId++;
			isRelatedLoading = false;
			relatedNotes = [];
		}
	}

	async function createNewDocument() {
		let wsId = workspaceStore.currentWorkspaceId;
		if (!wsId) {
			// Jika belum ada workspace sama sekali, buatkan otomatis
			try {
				const newWs = await workspaceStore.createWorkspace('My Workspace');
				wsId = newWs.id;
			} catch {
				toast.warning('Silakan buat workspace terlebih dahulu lewat menu di sidebar kiri.');
				return;
			}
		}

		try {
			isSaving = true;
			statusMessage = 'Membuat dokumen baru...';
			const defaultTitle = `Catatan Baru ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
			const res = await fetchApi<{ message: string; document: DocumentItem }>(
				`/api/workspaces/${wsId}/documents`,
				{
					method: 'POST',
					body: JSON.stringify({
						title: defaultTitle,
						content: '# Catatan Baru\n\nMulai menulis di sini...',
						folder_id: folderStore.selectedFolderId || undefined,
						is_public: false
					})
				}
			);
			const newDoc = res.document;
			documents = [newDoc, ...documents];
			selectDocument(newDoc);
			saveStatus = 'saved';
			statusMessage = 'Dokumen baru dibuat';
		} catch (err: unknown) {
			console.error('Gagal membuat dokumen:', err);
			const msg = err instanceof Error ? err.message : 'Gagal membuat dokumen baru';
			toast.error(`Gagal membuat dokumen: ${msg}`);
			statusMessage = msg;
		} finally {
			isSaving = false;
		}
	}

	function handleContentChange(markdown: string) {
		editorContent = markdown;
		saveStatus = 'idle';

		// Trigger auto-save debounce (2 detik setelah selesai mengetik)
		if (autoSaveTimer) clearTimeout(autoSaveTimer);
		autoSaveTimer = setTimeout(() => {
			if (currentDoc) {
				saveDocument();
			}
		}, 2000);
	}

	async function saveDocument(forceVersion?: number) {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!currentDoc || !wsId) return;

		const versionToSend = forceVersion !== undefined ? forceVersion : currentDoc.version;
		isSaving = true;
		saveStatus = 'saving';
		statusMessage = 'Menyimpan...';

		try {
			const res = await fetchApi<{ message: string; document: DocumentItem }>(
				`/api/workspaces/${wsId}/documents/${currentDoc.id}`,
				{
					method: 'PUT',
					body: JSON.stringify({
						title: editorTitle,
						content: editorContent,
						folder_id: currentDoc.folder_id || undefined,
						is_public: isPublic,
						version: versionToSend
					})
				}
			);

			// Berhasil simpan
			const updatedDoc = res.document;
			currentDoc = updatedDoc;
			saveStatus = 'saved';
			statusMessage = 'Tersimpan';

			// Update di list dokumen
			documents = documents.map((d) => (d.id === updatedDoc.id ? updatedDoc : d));
		} catch (err: unknown) {
			if (err instanceof ApiError && err.status === 409) {
				// Terjadi konflik versi (Optimistic Locking T-101 / T-303)
				saveStatus = 'error';
				statusMessage = 'Konflik versi terdeteksi!';
				await handleConflict();
				return;
			}
			saveStatus = 'error';
			statusMessage = err instanceof Error ? err.message : 'Gagal menyimpan dokumen';
			console.error('Gagal menyimpan dokumen:', err);
		} finally {
			isSaving = false;
		}
	}

	async function handleConflict() {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!currentDoc || !wsId) return;
		try {
			// Ambil versi terbaru yang ada di server
			const res = await fetchApi<{ document: DocumentItem }>(
				`/api/workspaces/${wsId}/documents/${currentDoc.id}`
			);
			const latestServerDoc = res.document;
			serverDocContent = latestServerDoc.content || '';
			serverDocVersion = latestServerDoc.version;
			isConflictOpen = true;
		} catch (err) {
			console.error('Gagal mengambil data server saat konflik:', err);
		}
	}

	function resolveConflictAcceptServer() {
		if (!currentDoc) return;
		// Timpa konten lokal dengan konten server
		editorContent = serverDocContent;
		currentDoc.content = serverDocContent;
		currentDoc.version = serverDocVersion;
		isConflictOpen = false;
		saveStatus = 'saved';
		statusMessage = 'Versi server berhasil dimuat';
	}

	async function resolveConflictKeepLocal() {
		if (!currentDoc) return;
		// Paksa timpa server dengan versi yang paling baru
		isConflictOpen = false;
		await saveDocument(serverDocVersion);
	}

	async function togglePublish(newPublicState: boolean) {
		const wsId = workspaceStore.currentWorkspaceId;
		if (!currentDoc || !wsId || isSaving) return;

		if (autoSaveTimer) clearTimeout(autoSaveTimer);

		isSaving = true;
		saveStatus = 'saving';
		statusMessage = newPublicState ? 'Mempublikasikan catatan...' : 'Menarik publikasi catatan...';

		try {
			const res = await fetchApi<{ message: string; document: DocumentItem }>(
				`/api/workspaces/${wsId}/documents/${currentDoc.id}`,
				{
					method: 'PUT',
					body: JSON.stringify({
						title: editorTitle,
						content: editorContent,
						folder_id: currentDoc.folder_id || undefined,
						is_public: newPublicState,
						version: currentDoc.version
					})
				}
			);

			const updatedDoc = res.document;
			currentDoc = updatedDoc;
			isPublic = updatedDoc.is_public;
			saveStatus = 'saved';
			statusMessage = newPublicState
				? 'Catatan berhasil dipublikasikan!'
				: 'Publikasi ditarik. Catatan kembali menjadi draf/privat.';

			documents = documents.map((d) => (d.id === updatedDoc.id ? updatedDoc : d));
		} catch (err: unknown) {
			if (err instanceof ApiError && err.status === 409) {
				saveStatus = 'error';
				statusMessage = 'Konflik versi terdeteksi!';
				await handleConflict();
				return;
			}
			saveStatus = 'error';
			statusMessage = err instanceof Error ? err.message : 'Gagal mengubah status publikasi';
			console.error('Gagal toggle publish:', err);
		} finally {
			isSaving = false;
		}
	}

	function navigateToWikilink(slug: string) {
		const targetDoc = documents.find((d) => d.slug === slug);
		if (targetDoc) {
			selectDocument(targetDoc);
		} else {
			toast.info(`Catatan dengan slug "[[${slug}]]" belum ada di workspace ini.`);
		}
	}
</script>

<div class="flex h-[calc(100vh-5rem)] gap-6">
	<!-- Panel Dokumen Workspace (Sidebar List) -->
	<div
		class="flex w-72 flex-shrink-0 flex-col rounded-2xl bg-[var(--bg-surface)] p-4 shadow-card ring-1 ring-zinc-900/5 dark:ring-zinc-800"
	>
		<div class="flex items-center justify-between border-b border-[var(--border-app-subtle)] pb-3">
			<div class="min-w-0 flex-1 pr-2">
				<div class="flex items-center gap-1.5">
					<h2 class="truncate text-xs font-semibold uppercase tracking-wider text-zinc-500">
						{#if folderStore.filterMode === 'uncategorized'}
							Uncategorized
						{:else if folderStore.filterMode === 'folder' && folderStore.selectedFolder}
							{folderStore.selectedFolder.name}
						{:else}
							Semua Catatan
						{/if}
					</h2>
					{#if folderStore.filterMode === 'folder' && folderStore.selectedFolder}
						<button
							type="button"
							onclick={() => {
								const wsId = workspaceStore.currentWorkspaceId;
								if (wsId && folderStore.selectedFolderId) {
									folderStore.openFolderIndex(wsId, folderStore.selectedFolderId);
								}
							}}
							title="Buka Halaman Indeks (README)"
							class="cursor-pointer rounded-lg border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700 shadow-2xs transition-all hover:bg-zinc-100 active:scale-[0.98]"
						>
							README
						</button>
					{/if}
				</div>
				<p class="mt-0.5 text-xs text-zinc-400">{filteredDocuments.length} dokumen</p>
			</div>
			<button
				type="button"
				onclick={createNewDocument}
				class="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-input transition-all hover:bg-zinc-800 active:scale-[0.98]"
			>
				<span>+</span>
				<span>Baru</span>
			</button>
		</div>

		<div class="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
			{#if isLoadingDocuments}
				<div class="space-y-2 p-1" data-testid="documents-loading">
					{#each Array(4) as _, i (i)}
						<div
							class="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 animate-pulse"
						>
							<div class="h-3.5 w-3/4 rounded-lg bg-zinc-200/80"></div>
							<div class="h-2.5 w-1/3 rounded-lg bg-zinc-200/60"></div>
						</div>
					{/each}
				</div>
			{:else if filteredDocuments.length === 0}
				<div class="py-12 text-center text-xs text-zinc-400">
					Belum ada catatan.<br />Klik <strong class="text-zinc-600">+ Baru</strong> untuk mulai.
				</div>
			{:else}
				{#each filteredDocuments as doc (doc.id)}
					<div
						role="group"
						draggable="true"
						ondragstart={(e) => {
							if (e.dataTransfer) {
								e.dataTransfer.setData('application/json', JSON.stringify(doc));
								e.dataTransfer.effectAllowed = 'move';
							}
						}}
						class="w-full cursor-grab rounded-xl text-left transition-all active:cursor-grabbing {selectedDocId ===
						doc.id
							? 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] shadow-2xs font-medium'
							: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]/60'}"
					>
						<button
							type="button"
							data-testid="document-item"
							onclick={() => {
								folderStore.openDocumentEditor();
								selectDocument(doc);
							}}
							class="flex w-full cursor-pointer flex-col gap-1 p-2.5 text-left active:scale-[0.99] transition-transform"
						>
							<div class="flex items-center justify-between gap-1.5">
								<span
									class="truncate text-sm font-semibold {selectedDocId === doc.id
										? 'text-[var(--text-primary)]'
										: 'text-[var(--text-secondary)]'}"
								>
									{doc.title}
								</span>
								<DocumentStatusBadge
									status={getDocumentStatus(doc, {
										memberCount: workspaceStore.memberCount,
										isIndexDocument: folderStore.folders.some((f) => f.index_document_id === doc.id)
									})}
									collaboratorCount={workspaceStore.memberCount}
									size="xs"
									showIcon={false}
								/>
							</div>
							<div class="flex items-center justify-between font-mono text-xs text-zinc-400">
								<span>[[{doc.slug}]]</span>
								<span class="text-[11px] text-zinc-400/80">v{doc.version}</span>
							</div>
						</button>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Main Editor Canvas -->
	<!-- Main Canvas: Toggle antara Folder Index View dan Document Editor -->
	{#if folderStore.viewMode === 'graph'}
		<div
			class="flex flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-card ring-1 ring-zinc-900/5 dark:ring-zinc-800"
		>
			<WorkspaceGraphView
				{documents}
				folders={folderStore.folders}
				onSelectDocument={(doc) => {
					folderStore.openDocumentEditor();
					selectDocument(doc);
				}}
				onClose={() => folderStore.openDocumentEditor()}
			/>
		</div>
	{:else if folderStore.viewMode === 'folder-index' && folderStore.selectedFolder}
		<div
			class="flex flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-card ring-1 ring-zinc-900/5 dark:ring-zinc-800"
		>
			<FolderIndexView
				{documents}
				onSelectDocument={(doc) => {
					folderStore.openDocumentEditor();
					selectDocument(doc);
				}}
				onCreateDocument={() => createNewDocument()}
			/>
		</div>
	{:else}
		<!-- Main Editor Canvas -->
		<div
			class="flex flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-card ring-1 ring-zinc-900/5 dark:ring-zinc-800"
		>
			{#if currentDoc}
				<!-- Editor Header / Metadata Bar -->
				<div
					class="flex min-h-[50px] items-center justify-between border-b border-[var(--border-app)] bg-[var(--bg-surface-subtle)]/60 px-6 py-2.5 backdrop-blur-sm"
				>
					<!-- Left side: Document slug & Save Indicator -->
					<div class="flex min-w-0 items-center gap-3">
						<div
							class="flex max-w-xs items-center gap-1 font-mono text-xs text-zinc-500 sm:max-w-sm"
						>
							<span class="truncate text-zinc-400">[[{currentDoc.slug}]]</span>
						</div>

						<div class="h-3.5 w-px bg-zinc-200"></div>

						<!-- Save Indicator -->
						<div class="flex shrink-0 items-center gap-1.5 text-xs">
							{#if saveStatus === 'saving'}
								<span class="inline-block h-2 w-2 animate-ping rounded-full bg-amber-500"></span>
								<span class="text-xs font-medium text-amber-700">Menyimpan...</span>
							{:else if saveStatus === 'saved'}
								<span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
								<span class="text-xs font-medium text-emerald-700"
									>{statusMessage || 'Tersimpan'}</span
								>
							{:else if saveStatus === 'error'}
								<span class="inline-block h-2 w-2 rounded-full bg-red-500"></span>
								<span class="text-xs font-medium text-red-700">{statusMessage}</span>
							{:else}
								<span class="font-mono text-[11px] text-zinc-400">v{currentDoc.version}</span>
							{/if}
						</div>
					</div>

					<!-- Right side controls -->
					<div class="flex shrink-0 items-center gap-2.5">
						<!-- Pipeline Status Badge -->
						<DocumentStatusBadge
							status={currentDocStatus}
							collaboratorCount={workspaceStore.memberCount}
							size="sm"
						/>

						<!-- Public Link (if Live and username available) -->
						{#if currentDoc.is_public && auth.username}
							<a
								href="/@{auth.username}"
								title="Buka profil dan catatan publik"
								class="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs transition-all hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98]"
							>
								<svg
									class="h-3.5 w-3.5 text-zinc-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
									/>
								</svg>
								<span>Lihat Publik</span>
							</a>
						{/if}

						<!-- Dedicated Publish / Unpublish Action Button -->
						{#if currentDoc.is_public}
							<button
								type="button"
								onclick={() => togglePublish(false)}
								disabled={isSaving}
								title="Kembalikan status catatan menjadi draf privat"
								class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-2xs transition-all hover:bg-amber-100 hover:border-amber-300 active:scale-[0.98] disabled:opacity-50"
							>
								<svg
									class="h-3.5 w-3.5 text-amber-600"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
									/>
								</svg>
								<span>Tarik Publikasi</span>
							</button>
						{:else}
							<button
								type="button"
								onclick={() => togglePublish(true)}
								disabled={isSaving}
								title="Publikasikan catatan ini ke profil publik"
								class="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-input transition-all hover:bg-zinc-800 active:scale-[0.98] disabled:opacity-50"
							>
								<svg
									class="h-3.5 w-3.5"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
									/>
								</svg>
								<span>Publikasikan</span>
							</button>
						{/if}

						<!-- Manual Save Button -->
						<button
							type="button"
							onclick={() => saveDocument()}
							disabled={isSaving}
							class="cursor-pointer rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-2xs transition-all hover:border-zinc-400 active:scale-[0.98] disabled:opacity-50"
						>
							{isSaving ? 'Menyimpan...' : 'Simpan'}
						</button>
					</div>
				</div>

				<!-- Editor Component Body -->
				<div class="flex-1 overflow-y-auto p-6 flex flex-col justify-between">
					<div>
						<!-- Clean, prominent document title input -->
						<div class="mb-6">
							<input
								type="text"
								bind:value={editorTitle}
								oninput={() => handleContentChange(editorContent)}
								placeholder="Judul Catatan..."
								class="w-full border-0 bg-transparent p-0 text-2xl font-bold tracking-tight text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-0 sm:text-3xl"
							/>
						</div>

						<MarkdownEditor
							bind:this={editorInstance}
							content={editorContent}
							onChange={handleContentChange}
							onWikilinkNavigate={navigateToWikilink}
							availableDocuments={documents.map((d) => ({
								id: d.id,
								title: d.title,
								slug: d.slug
							}))}
						/>
					</div>
					<RelatedNotesPanel
						{relatedNotes}
						isLoading={isRelatedLoading}
						onSelect={(noteId) => {
							const target = documents.find((d) => d.id === noteId);
							if (target) {
								if (
									folderStore.filterMode === 'folder' &&
									target.folder_id !== folderStore.selectedFolderId
								) {
									folderStore.selectFolder(target.folder_id);
								} else if (
									folderStore.filterMode === 'uncategorized' &&
									target.folder_id !== null
								) {
									folderStore.selectFolder(null);
								}
								selectDocument(target);
							} else {
								const wsId = workspaceStore.currentWorkspaceId;
								if (wsId) {
									fetchApi<{ document: DocumentItem }>(
										`/api/workspaces/${wsId}/documents/${noteId}`
									)
										.then((res) => {
											if (res.document) {
												documents = [
													res.document,
													...documents.filter((d) => d.id !== res.document.id)
												];
												if (
													folderStore.filterMode === 'folder' &&
													res.document.folder_id !== folderStore.selectedFolderId
												) {
													folderStore.selectFolder(res.document.folder_id);
												} else if (
													folderStore.filterMode === 'uncategorized' &&
													res.document.folder_id !== null
												) {
													folderStore.selectFolder(null);
												}
												selectDocument(res.document);
											}
										})
										.catch((err) => {
											console.error('Gagal membuka catatan terkait:', err);
										});
								}
							}
						}}
					/>
				</div>
			{:else}
				<div class="flex flex-1 flex-col items-center justify-center p-8 text-center text-zinc-400">
					<div class="mb-3 rounded-2xl bg-zinc-100 p-4 text-zinc-600 shadow-input">
						<svg
							class="h-8 w-8"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
							/>
						</svg>
					</div>
					<h3 class="text-base font-semibold tracking-tight text-zinc-800">
						Belum ada catatan yang dipilih
					</h3>
					<p class="mt-1 max-w-sm text-xs text-zinc-500">
						Pilih salah satu catatan dari daftar di sebelah kiri atau klik tombol <strong
							class="text-zinc-700">+ Baru</strong
						> untuk membuat catatan baru.
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Modal Dialog Penanganan Konflik Optimistic Locking 409 -->
<ConflictModal
	isOpen={isConflictOpen}
	currentTitle={editorTitle}
	currentContent={editorContent}
	serverContent={serverDocContent}
	serverVersion={serverDocVersion}
	onAcceptServer={resolveConflictAcceptServer}
	onKeepLocal={resolveConflictKeepLocal}
	onCancel={() => (isConflictOpen = false)}
/>
