<script lang="ts">
	import { fetchApi, ApiError } from '$lib/api';
	import { workspaceStore } from '$lib/stores/workspace.svelte';
	import type { DocumentItem } from '$lib/types';
	import MarkdownEditor from '$lib/components/editor/MarkdownEditor.svelte';
	import ConflictModal from '$lib/components/editor/ConflictModal.svelte';

	let documents: DocumentItem[] = $state([]);
	let selectedDocId = $state<string | null>(null);

	// Status Dokumen yang sedang diedit
	let currentDoc = $state<DocumentItem | null>(null);
	let editorTitle = $state('');
	let editorContent = $state('');
	let isPublic = $state(false);
	let isSaving = $state(false);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let statusMessage = $state('');

	// Konflik Optimistic Locking (HTTP 409)
	let isConflictOpen = $state(false);
	let serverDocContent = $state('');
	let serverDocVersion = $state(0);

	let editorInstance: MarkdownEditor | undefined = $state();

	// Debounce auto-save
	let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;

	// Ketika workspace yang dipilih berubah di layout/store, reload dokumennya
	$effect(() => {
		const wsId = workspaceStore.currentWorkspaceId;
		if (wsId) {
			loadDocuments(wsId);
		} else {
			documents = [];
			currentDoc = null;
			selectedDocId = null;
		}
	});

	async function loadDocuments(workspaceId: string) {
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
		} catch (err) {
			console.error('Gagal mengambil daftar dokumen:', err);
		}
	}

	function selectDocument(doc: DocumentItem) {
		if (autoSaveTimer) clearTimeout(autoSaveTimer);
		selectedDocId = doc.id;
		currentDoc = doc;
		editorTitle = doc.title;
		editorContent = doc.content || '';
		isPublic = doc.is_public;
		saveStatus = 'idle';
		statusMessage = '';
	}

	async function createNewDocument() {
		let wsId = workspaceStore.currentWorkspaceId;
		if (!wsId) {
			// Jika belum ada workspace sama sekali, buatkan otomatis
			try {
				const newWs = await workspaceStore.createWorkspace('My Workspace');
				wsId = newWs.id;
			} catch {
				alert('Silakan buat workspace terlebih dahulu lewat menu di sidebar kiri.');
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
			alert(`Gagal membuat dokumen: ${msg}`);
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

	function navigateToWikilink(slug: string) {
		const targetDoc = documents.find((d) => d.slug === slug);
		if (targetDoc) {
			selectDocument(targetDoc);
		} else {
			alert(`Catatan dengan slug "[[${slug}]]" belum ada di workspace ini.`);
		}
	}
</script>

<div class="flex h-[calc(100vh-5rem)] gap-6">
	<!-- Panel Dokumen Workspace (Sidebar List) -->
	<div
		class="w-72 flex-shrink-0 flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-xs"
	>
		<div class="flex items-center justify-between pb-3 border-b border-gray-100">
			<div>
				<h2 class="text-xs font-bold text-gray-800 uppercase tracking-wider">Catatan</h2>
				<p class="text-xs text-gray-500">{documents.length} dokumen</p>
			</div>
			<button
				type="button"
				onclick={createNewDocument}
				class="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
			>
				<span>+</span>
				<span>Baru</span>
			</button>
		</div>

		<div class="mt-3 flex-1 overflow-y-auto space-y-1">
			{#if documents.length === 0}
				<div class="py-8 text-center text-xs text-gray-400">
					Belum ada catatan.<br />Klik <strong>+ Baru</strong> untuk mulai.
				</div>
			{:else}
				{#each documents as doc (doc.id)}
					<button
						type="button"
						onclick={() => selectDocument(doc)}
						class="w-full text-left rounded-lg px-3 py-2.5 transition-colors flex flex-col gap-0.5 cursor-pointer {selectedDocId ===
						doc.id
							? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
							: 'hover:bg-gray-50 text-gray-700'}"
					>
						<div class="flex items-center justify-between">
							<span class="text-sm font-semibold truncate">{doc.title}</span>
							{#if doc.is_public}
								<span
									class="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium"
								>
									Publik
								</span>
							{/if}
						</div>
						<div class="flex items-center justify-between text-xs text-gray-400 font-mono">
							<span>[[{doc.slug}]]</span>
							<span class="text-[11px]">v{doc.version}</span>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Main Editor Canvas -->
	<div
		class="flex-1 flex flex-col rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden"
	>
		{#if currentDoc}
			<!-- Editor Header / Metadata Bar -->
			<div
				class="flex items-center justify-between border-b border-gray-200 bg-gray-50/70 px-6 py-3"
			>
				<div class="flex items-center gap-3 flex-1 max-w-xl">
					<input
						type="text"
						bind:value={editorTitle}
						oninput={() => handleContentChange(editorContent)}
						placeholder="Judul Catatan..."
						class="w-full bg-transparent font-bold text-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-0"
					/>
				</div>

				<div class="flex items-center gap-4">
					<!-- Save Indicator -->
					<div class="text-xs flex items-center gap-1.5">
						{#if saveStatus === 'saving'}
							<span class="inline-block h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
							<span class="text-amber-700">Menyimpan...</span>
						{:else if saveStatus === 'saved'}
							<span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
							<span class="text-emerald-700">{statusMessage || 'Tersimpan'}</span>
						{:else if saveStatus === 'error'}
							<span class="inline-block h-2 w-2 rounded-full bg-red-500"></span>
							<span class="text-red-700">{statusMessage}</span>
						{:else}
							<span class="text-gray-400 font-mono text-[11px]">v{currentDoc.version}</span>
						{/if}
					</div>

					<!-- Public Toggle -->
					<label class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
						<input
							type="checkbox"
							bind:checked={isPublic}
							onchange={() => saveDocument()}
							class="rounded text-emerald-600 focus:ring-emerald-500"
						/>
						<span>Publik</span>
					</label>

					<!-- Manual Save Button -->
					<button
						type="button"
						onclick={() => saveDocument()}
						disabled={isSaving}
						class="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
					>
						{isSaving ? 'Menyimpan...' : 'Simpan (Ctrl+S)'}
					</button>
				</div>
			</div>

			<!-- Editor Component Body -->
			<div class="flex-1 overflow-y-auto p-6">
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
		{:else}
			<div class="flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-400">
				<div class="rounded-full bg-emerald-50 p-4 text-emerald-600 mb-3">
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
				<h3 class="text-base font-semibold text-gray-700">Belum ada catatan yang dipilih</h3>
				<p class="text-xs text-gray-500 mt-1 max-w-sm">
					Pilih salah satu catatan dari daftar di sebelah kiri atau klik tombol <strong
						>+ Baru</strong
					> untuk membuat catatan baru.
				</p>
			</div>
		{/if}
	</div>
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
