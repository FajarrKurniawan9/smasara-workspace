<script lang="ts">
	import { page } from '$app/stores';
	import { fetchApi } from '$lib/api';
	import type { PublicProfileResponse, PublicDocumentItem } from '$lib/types';
	import { PublicGraphView } from '$lib/components/graph';
	let usernameParam = $derived($page.params.username);
	let cleanUsername = $derived(usernameParam ? usernameParam.replace(/^@/, '') : '');

	let profileData = $state<PublicProfileResponse | null>(null);
	let isLoading = $state(true);
	let errorMessage = $state<string | null>(null);
	let activeTab = $state<'feed' | 'graph'>('feed');
	let highlightedDocId = $state<string | null>(null);
	async function loadPublicProfile(user: string) {
		if (!user) return;
		isLoading = true;
		try {
			const res = await fetchApi<PublicProfileResponse>(`/api/public/profiles/${user}`);
			// Pastikan documents adalah array agar tidak error jika backend mengembalikan null
			res.documents = res.documents || [];
			profileData = res;
		} catch (err: unknown) {
			const e = err as { message?: string; status?: number };
			if (e.status === 404) {
				errorMessage = `Pengguna @${user} tidak ditemukan.`;
			} else {
				errorMessage = e.message || 'Gagal memuat profil pengguna.';
			}
			profileData = null;
		} finally {
			isLoading = false;
		}
	}

	function handleSelectDocument(doc: PublicDocumentItem) {
		activeTab = 'feed';
		highlightedDocId = doc.id;
		setTimeout(() => {
			const el = document.getElementById(`doc-${doc.id}`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}, 50);
	}
	$effect(() => {
		if (cleanUsername) {
			loadPublicProfile(cleanUsername);
		}
	});

	function formatDate(dateStr: string | null) {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('id-ID', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getExcerpt(content: string | null, maxLength = 160): string {
		if (!content) return 'Tidak ada deskripsi.';
		// Hilangkan markdown heading dan tag sederhana untuk ringkasan bersih
		const plain = content
			.replace(/^#+\s+/gm, '')
			.replace(/\[\[(.*?)\]\]/g, '$1')
			.replace(/[*_`]/g, '')
			.trim();
		if (plain.length <= maxLength) return plain;
		return plain.slice(0, maxLength) + '...';
	}
</script>

<svelte:head>
	<title>{cleanUsername ? `@${cleanUsername} - Profil Publik Smasara` : 'Profil Publik'}</title>
</svelte:head>

<div class="min-h-screen bg-neutral-50 text-neutral-900">
	<!-- Header Navigasi Minimalis / Brand -->
	<header class="border-b border-neutral-200 bg-white">
		<div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
			<a
				href="/"
				class="flex items-center gap-2 font-bold tracking-tight text-neutral-900 hover:opacity-80"
			>
				<div
					class="flex h-7 w-7 items-center justify-center rounded bg-neutral-900 text-xs font-bold text-white"
				>
					S
				</div>
				<span>Smasara</span>
			</a>
			<div class="flex items-center gap-3">
				<a
					href="/login"
					class="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
				>
					Masuk
				</a>
				<a
					href="/register"
					class="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
				>
					Mulai Gratis
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-4xl px-4 py-8">
		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-20 text-neutral-500">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800"
				></div>
				<p class="mt-4 text-sm font-medium">Memuat profil @{cleanUsername}...</p>
			</div>
		{:else if errorMessage}
			<div class="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
				<p class="text-base font-semibold">{errorMessage}</p>
				<p class="mt-2 text-xs text-red-500">Periksa kembali penulisan username pada URL.</p>
				<a
					href="/"
					class="mt-4 inline-block rounded-md bg-white px-4 py-2 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
				>
					Kembali ke Beranda
				</a>
			</div>
		{:else if profileData}
			<!-- Profil Header Card -->
			<div class="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
				<div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
					{#if profileData.profile.avatar_url}
						<img
							src={profileData.profile.avatar_url}
							alt={profileData.profile.full_name}
							class="h-20 w-20 rounded-full border border-neutral-200 object-cover shadow-sm"
						/>
					{:else}
						<div
							class="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-900 text-2xl font-bold text-white shadow-sm"
						>
							{profileData.profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
						</div>
					{/if}

					<div class="flex-1">
						<h1 class="text-2xl font-bold text-neutral-900 sm:text-3xl">
							{profileData.profile.full_name}
						</h1>
						<p class="text-sm font-medium text-neutral-500">
							@{profileData.profile.username}
						</p>
						<p class="mt-2 text-xs text-neutral-400">Catatan & Artikel Publik</p>
					</div>

					<div
						class="flex items-center gap-2 rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700"
					>
						<span>{profileData.documents.length}</span>
						<span>Dokumen Publik</span>
					</div>
				</div>
			</div>

			<!-- Tab Switcher: Feed vs Graph (T-503 Toggle Graph View) -->
			<section class="mt-8 flex flex-col gap-4">
				<div
					class="flex flex-col justify-between gap-3 border-b border-neutral-200 pb-3 sm:flex-row sm:items-center"
				>
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => (activeTab = 'feed')}
							class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all {activeTab ===
							'feed'
								? 'bg-neutral-900 text-white shadow-xs'
								: 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100'}"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
								/>
							</svg>
							<span>Feed Publikasi</span>
							<span
								class="rounded-full px-1.5 py-0.2 text-[10px] font-bold {activeTab === 'feed'
									? 'bg-neutral-800 text-neutral-200'
									: 'bg-neutral-100 text-neutral-600'}"
							>
								{profileData.documents.length}
							</span>
						</button>

						<button
							type="button"
							onclick={() => (activeTab = 'graph')}
							class="flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all {activeTab ===
							'graph'
								? 'bg-neutral-900 text-white shadow-xs'
								: 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100'}"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 10V3L4 14h7v7l9-11h-7z"
								/>
							</svg>
							<span>Peta Graf (Graph View)</span>
						</button>
					</div>

					<span class="text-xs text-neutral-500">
						{activeTab === 'feed'
							? 'Daftar artikel publik urut tanggal publikasi terbaru'
							: 'Grafik visualisasi simpul & koneksi antar-catatan publik (max 100)'}
					</span>
				</div>

				<!-- Konten Tab Feed -->
				{#if activeTab === 'feed'}
					{#if profileData.documents.length === 0}
						<div
							class="rounded-xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-500"
						>
							<svg
								class="mx-auto h-10 w-10 text-neutral-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
								/>
							</svg>
							<p class="mt-3 text-sm font-semibold text-neutral-700">Belum Ada Dokumen Publik</p>
							<p class="mt-1 text-xs text-neutral-400">
								@{profileData.profile.username} belum menerbitkan catatan publik apapun.
							</p>
						</div>
					{:else}
						<div class="space-y-4">
							{#each profileData.documents as doc (doc.id)}
								<article
									id="doc-{doc.id}"
									class="group rounded-xl border bg-white p-5 shadow-xs transition hover:border-neutral-300 hover:shadow-sm {highlightedDocId ===
									doc.id
										? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20'
										: 'border-neutral-200'}"
								>
									<div class="flex items-start justify-between gap-4">
										<div>
											<h3 class="text-lg font-bold text-neutral-900 group-hover:text-blue-600">
												{doc.title}
											</h3>
											<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
												{#if doc.published_at}
													<span>Diterbitkan {formatDate(doc.published_at)}</span>
													<span>•</span>
												{/if}
												<span>Workspace: {doc.workspace_name}</span>
												{#if doc.folder_name}
													<span>•</span>
													<span class="rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600">
														{doc.folder_name}
													</span>
												{/if}
											</div>
										</div>
										<span
											class="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700"
										>
											Live
										</span>
									</div>

									<p class="mt-3 text-sm leading-relaxed text-neutral-600">
										{getExcerpt(doc.content)}
									</p>
								</article>
							{/each}
						</div>
					{/if}
				{:else if activeTab === 'graph'}
					<!-- Konten Tab Graph (T-503 Public Graph View) -->
					<PublicGraphView
						documents={profileData.documents}
						onSelectDocument={handleSelectDocument}
					/>
				{/if}
			</section>
		{/if}
	</main>
</div>
