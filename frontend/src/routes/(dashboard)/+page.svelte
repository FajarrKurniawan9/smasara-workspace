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
	import { TrashView } from '$lib/components/trash';
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

	// Status Penghapusan Dokumen (Delete Document)
	let isDeleting = $state(false);
	let isDeleteModalOpen = $state(false);
	let docToDelete = $state<DocumentItem | null>(null);

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

	// Listener untuk pemulihan dokumen dari Recycle Bin
	$effect(() => {
		const handleRestored = async (e: Event) => {
			const custom = e as CustomEvent<{ document: DocumentItem }>;
			const doc = custom.detail?.document;
			if (doc) {
				documents = [doc, ...documents.filter((d) => d.id !== doc.id)];
			}
			const wsId = workspaceStore.currentWorkspaceId;
			if (wsId) {
				await loadDocuments(wsId);
			}
		};
		window.addEventListener('documentrestored', handleRestored);
		return () => {
			window.removeEventListener('documentrestored', handleRestored);
		};
	});

	// Listener untuk penghapusan folder (refresh daftar dokumen)
	$effect(() => {
		const handleFolderDeleted = async () => {
			const wsId = workspaceStore.currentWorkspaceId;
			if (wsId) {
				await loadDocuments(wsId);
			}
		};
		window.addEventListener('folderdeleted', handleFolderDeleted);
		return () => {
			window.removeEventListener('folderdeleted', handleFolderDeleted);
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
		if (folderStore.viewMode === 'trash') {
			folderStore.openDocumentEditor();
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

		const targetDocId = currentDoc.id;
		const versionToSend = forceVersion !== undefined ? forceVersion : currentDoc.version;
		isSaving = true;
		saveStatus = 'saving';
		statusMessage = 'Menyimpan...';

		try {
			const res = await fetchApi<{ message: string; document: DocumentItem }>(
				`/api/workspaces/${wsId}/documents/${targetDocId}`,
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

			// Jika dokumen telah dihapus selagi request berjalan, abaikan respon
			if (!documents.some((d) => d.id === targetDocId)) {
				return;
			}

			// Berhasil simpan
			const updatedDoc = res.document;
			if (currentDoc && currentDoc.id === targetDocId) {
				currentDoc = updatedDoc;
				saveStatus = 'saved';
			}
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

	function promptDeleteDocument(doc: DocumentItem | null) {
		if (!doc) return;
		docToDelete = doc;
		isDeleteModalOpen = true;
	}

	async function confirmDeleteDocument() {
		const wsId = workspaceStore.currentWorkspaceId;
		const doc = docToDelete;
		if (!doc || !wsId || isDeleting) return;

		// Hanya bersihkan timer auto-save jika dokumen yang dihapus adalah dokumen aktif
		const isDeletingCurrentDoc = currentDoc?.id === doc.id;
		if (isDeletingCurrentDoc && autoSaveTimer) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = undefined;
		}

		try {
			isDeleting = true;
			await fetchApi(`/api/workspaces/${wsId}/documents/${doc.id}`, {
				method: 'DELETE'
			});

			toast.success(`Catatan "${doc.title}" berhasil dipindahkan ke Recycle Bin`);

			// Hapus dokumen dari daftar lokal
			documents = documents.filter((d) => d.id !== doc.id);

			// Jika dokumen yang dihapus sedang dibuka di editor
			if (isDeletingCurrentDoc) {
				const remainingInFilter = filteredDocuments.filter((d) => d.id !== doc.id);
				if (remainingInFilter.length > 0) {
					selectDocument(remainingInFilter[0]);
				} else {
					currentDoc = null;
					selectedDocId = null;
					editorTitle = '';
					editorContent = '';
					saveStatus = 'idle';
					statusMessage = '';
				}
			}
		} catch (err: unknown) {
			console.error('Gagal menghapus dokumen:', err);
			const msg = err instanceof Error ? err.message : 'Gagal menghapus dokumen';
			toast.error(msg);
		} finally {
			isDeleting = false;
			isDeleteModalOpen = false;
			docToDelete = null;
		}
	}
</script>

<div class="flex h-[calc(100vh-5rem)] gap-6">
	<!-- Panel Dokumen Workspace (Sidebar List) -->
	<div class="flex w-64 flex-shrink-0 flex-col rounded-xl bg-[var(--bg-surface)] p-3">
		<div class="flex items-center justify-between pb-2.5">
			<div class="min-w-0 flex-1 pr-2">
				<div class="flex items-center gap-1.5">
					<h2 class="section-label truncate">
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
							class="btn-toolbar text-[9px] px-1 py-0"
						>
							README
						</button>
					{/if}
				</div>
				<p class="mt-0.5 text-[10px] text-[var(--text-muted)]">
					{filteredDocuments.length} dokumen
				</p>
			</div>
			<button
				type="button"
				onclick={createNewDocument}
				class="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-[var(--text-primary)] px-2.5 py-1 text-xs font-medium text-[var(--bg-surface)] transition-colors hover:opacity-90 active:scale-[0.97]"
			>
				<span>+</span>
				<span>Baru</span>
			</button>
		</div>

		<div class="mt-2 flex-1 space-y-1 overflow-y-auto pr-0.5">
			{#if isLoadingDocuments}
				<div class="space-y-1.5 p-1" data-testid="documents-loading">
					{#each Array(4) as _, i (i)}
						<div class="space-y-1.5 rounded-lg bg-[var(--bg-surface-subtle)] p-2.5 animate-pulse">
							<div class="h-3 w-3/4 rounded bg-[var(--border-app)]"></div>
							<div class="h-2 w-1/3 rounded bg-[var(--border-app-subtle)]"></div>
						</div>
					{/each}
				</div>
			{:else if filteredDocuments.length === 0}
				<div class="py-10 text-center">
					<p class="text-xs text-[var(--text-muted)]">Belum ada catatan.</p>
					<p class="mt-1 text-[10px] text-[var(--text-muted)]">
						Klik <span class="font-medium text-[var(--text-secondary)]">+ Baru</span> untuk mulai.
					</p>
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
						class="group relative flex w-full items-center justify-between rounded-lg transition-colors cursor-grab active:cursor-grabbing {selectedDocId ===
						doc.id
							? 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]'
							: 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]/50'}"
					>
						<button
							type="button"
							data-testid="document-item"
							onclick={() => {
								folderStore.openDocumentEditor();
								selectDocument(doc);
							}}
							class="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 p-2 text-left active:scale-[0.99] transition-transform"
						>
							<div class="flex items-center justify-between gap-1.5">
								<span
									class="truncate text-[13px] {selectedDocId === doc.id
										? 'font-medium text-[var(--text-primary)]'
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
							<div
								class="flex items-center justify-between font-mono text-[10px] text-[var(--text-muted)]"
							>
								<span>[[{doc.slug}]]</span>
								<span class="text-[11px] opacity-80">v{doc.version}</span>
							</div>
						</button>
						<div class="pr-2 shrink-0">
							<button
								type="button"
								onclick={() => promptDeleteDocument(doc)}
								title="Hapus catatan"
								aria-label={`Hapus catatan ${doc.title}`}
								data-testid="delete-document-item-btn"
								class="opacity-0 group-hover:opacity-100 focus:opacity-100 rounded p-1 text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600 transition-colors cursor-pointer"
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
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
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
	{:else if folderStore.viewMode === 'trash'}
		<div
			class="flex flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-card ring-1 ring-zinc-900/5 dark:ring-zinc-800"
		>
			<TrashView
				onDocumentRestored={async (doc) => {
					documents = [doc, ...documents.filter((d) => d.id !== doc.id)];
					const wsId = workspaceStore.currentWorkspaceId;
					if (wsId) {
						await loadDocuments(wsId);
					}
				}}
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
					class="flex min-h-[44px] items-center justify-between border-b border-[var(--border-app-subtle)] bg-[var(--bg-surface)] px-5 py-2"
				>
					<!-- Left side: Document slug & Save Indicator -->
					<div class="flex min-w-0 items-center gap-3">
						<div
							class="flex max-w-xs items-center gap-1 font-mono text-[11px] text-[var(--text-muted)] sm:max-w-sm"
						>
							<span class="truncate">[[{currentDoc.slug}]]</span>
						</div>

						<div class="h-3 w-px bg-[var(--border-app-subtle)]"></div>

						<!-- Save Indicator -->
						<div class="flex shrink-0 items-center gap-1.5 text-xs">
							{#if saveStatus === 'saving'}
								<span class="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-amber-500"
								></span>
								<span class="text-[11px] font-medium text-[var(--text-secondary)]"
									>Menyimpan...</span
								>
							{:else if saveStatus === 'saved'}
								<span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
								<span class="text-[11px] font-medium text-[var(--text-secondary)]"
									>{statusMessage || 'Tersimpan'}</span
								>
							{:else if saveStatus === 'error'}
								<span class="inline-block h-1.5 w-1.5 rounded-full bg-red-500"></span>
								<span class="text-[11px] font-medium text-red-600">{statusMessage}</span>
							{:else}
								<span class="font-mono text-[10px] text-[var(--text-muted)]"
									>v{currentDoc.version}</span
								>
							{/if}
						</div>
					</div>

					<!-- Right side controls -->
					<div class="flex shrink-0 items-center gap-2">
						<!-- Pipeline Status Badge -->
						<DocumentStatusBadge
							status={currentDocStatus}
							collaboratorCount={workspaceStore.memberCount}
							size="xs"
						/>

						<!-- Public Link (if Live and username available) -->
						{#if currentDoc.is_public && auth.username}
							<a
								href="/@{auth.username}"
								title="Buka profil dan catatan publik"
								class="btn-toolbar"
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
								class="btn-toolbar text-amber-700 hover:bg-amber-500/10 hover:text-amber-800"
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
								<span>Tarik</span>
							</button>
						{:else}
							<button
								type="button"
								onclick={() => togglePublish(true)}
								disabled={isSaving}
								title="Publikasikan catatan ini ke profil publik"
								class="btn-toolbar text-[var(--text-primary)] font-medium"
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
							class="btn-toolbar"
						>
							{isSaving ? 'Menyimpan...' : 'Simpan'}
						</button>

						<!-- Delete Document Button -->
						<button
							type="button"
							onclick={() => promptDeleteDocument(currentDoc)}
							disabled={isDeleting || isSaving}
							title="Hapus catatan ini"
							aria-label="Hapus catatan"
							data-testid="delete-document-btn"
							class="btn-toolbar text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-600"
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
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
							<span class="hidden sm:inline">Hapus</span>
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
				<div class="flex flex-1 flex-col items-center justify-center p-8 text-center">
					<h3 class="text-sm font-medium tracking-tight text-[var(--text-primary)]">
						Belum ada catatan yang dipilih
					</h3>
					<p class="mt-1 max-w-xs text-xs text-[var(--text-muted)]">
						Pilih salah satu catatan dari daftar atau buat baru.
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

<!-- Modal Dialog Konfirmasi Hapus Catatan -->
{#if isDeleteModalOpen && docToDelete}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="delete-doc-modal-title"
	>
		<div
			class="w-full max-w-sm rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-2xl transition-all text-[var(--text-primary)]"
		>
			<div class="mb-4 flex items-center gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-600"
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
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
				</div>
				<div>
					<h3
						id="delete-doc-modal-title"
						class="text-base font-semibold tracking-tight text-[var(--text-primary)]"
					>
						Hapus Catatan
					</h3>
					<p class="text-xs text-[var(--text-secondary)]">Pindahkan ke Recycle Bin</p>
				</div>
			</div>

			<p class="text-sm text-[var(--text-secondary)] leading-relaxed">
				Apakah Anda yakin ingin memindahkan catatan <strong
					class="text-[var(--text-primary)] font-semibold">"{docToDelete.title}"</strong
				>
				ke Recycle Bin? Anda dapat memulihkannya kapan saja melalui menu
				<strong class="text-[var(--text-primary)] font-semibold">Recycle Bin</strong> di bagian bawah
				navigasi folder.
			</p>

			<div class="mt-6 flex items-center justify-end gap-2.5">
				<button
					type="button"
					onclick={() => {
						isDeleteModalOpen = false;
						docToDelete = null;
					}}
					disabled={isDeleting}
					class="btn-ghost cursor-pointer"
				>
					Batal
				</button>
				<button
					type="button"
					onclick={confirmDeleteDocument}
					disabled={isDeleting || isSaving}
					data-testid="confirm-delete-doc-btn"
					class="inline-flex cursor-pointer items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-input transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
				>
					{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
				</button>
			</div>
		</div>
	</div>
{/if}
