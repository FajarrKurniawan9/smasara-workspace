<script lang="ts">
	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onSelect: (slug: string, title?: string) => void;
		availableDocuments?: Array<{ id: string; title: string; slug: string }>;
		currentDocumentId?: string | null;
	}

	let {
		isOpen,
		onClose,
		onSelect,
		availableDocuments = [],
		currentDocumentId = null
	}: Props = $props();

	let searchQuery = $state('');
	let manualSlug = $state('');

	let filteredDocs = $derived.by(() => {
		const docs = availableDocuments.filter((d) => d.id !== currentDocumentId);
		const q = searchQuery.toLowerCase().trim();
		if (!q) return docs;
		return docs.filter(
			(d) => d.title.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q)
		);
	});

	function handlePick(slug: string, title?: string) {
		onSelect(slug, title);
		searchQuery = '';
		manualSlug = '';
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (isOpen && e.key === 'Escape') {
			onClose();
		}
	}

	function handleManualSubmit(e: SubmitEvent) {
		e.preventDefault();
		const slugToUse = manualSlug.trim() || searchQuery.trim();
		if (slugToUse) {
			handlePick(slugToUse);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
		role="dialog"
		aria-modal="true"
		aria-labelledby="wikilink-modal-title"
	>
		<!-- Backdrop click handler -->
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-transparent"
			tabindex="-1"
			aria-label="Tutup modal"
			onclick={onClose}
		></button>

		<div
			class="relative w-full max-w-md rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-4"
		>
			<div class="flex items-start justify-between pb-3 border-b border-[var(--border-app-subtle)]">
				<div class="flex items-center gap-2.5">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400"
					>
						[[ ]]
					</div>
					<div>
						<h3
							id="wikilink-modal-title"
							class="text-base font-semibold text-[var(--text-primary)]"
						>
							Sisipkan Wikilink Catatan
						</h3>
						<p class="text-xs text-[var(--text-muted)]">
							Tautkan catatan ini ke dokumen lain di workspace
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
					aria-label="Tutup modal wikilink"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						class="w-5 h-5"
					>
						<path d="M10 13a5 5 0 0 0 7.07-7.07" />
						<path d="M14 11a5 5 0 0 1-7.07 7.07" />
					</svg>
				</button>
			</div>

			<div class="mt-2">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Cari judul catatan atau slug..."
					class="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] px-3.5 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] transition-colors focus:border-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--text-primary)]"
				/>
			</div>

			<!-- List Catatan yang Tersedia -->
			<div
				class="max-h-52 overflow-y-auto divide-y divide-[var(--border-app-subtle)] rounded-xl border border-[var(--border-app-subtle)] bg-[var(--bg-surface)]"
			>
				{#if filteredDocs.length > 0}
					{#each filteredDocs as doc (doc.id)}
						<button
							type="button"
							onclick={() => handlePick(doc.slug, doc.title)}
							class="w-full text-left px-3.5 py-2.5 hover:bg-[var(--bg-surface-subtle)] transition-colors flex flex-col group"
						>
							<span
								class="text-sm font-medium text-[var(--text-primary)] group-hover:text-emerald-600 transition-colors"
							>
								{doc.title}
							</span>
							<span
								class="text-xs font-mono text-[var(--text-muted)] group-hover:text-emerald-500 transition-colors"
							>
								[[{doc.slug}]]
							</span>
						</button>
					{/each}
				{:else}
					<div class="p-4 text-center text-xs text-[var(--text-muted)]">
						Tidak ada dokumen yang cocok dengan kata kunci.
					</div>
				{/if}
			</div>

			<!-- Opsi Buat Manual atau slug baru -->
			<form onsubmit={handleManualSubmit} class="pt-3 border-t border-[var(--border-app-subtle)]">
				<label
					for="manual-slug"
					class="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
				>
					Atau gunakan slug / rujukan baru:
				</label>
				<div class="flex gap-2">
					<input
						id="manual-slug"
						type="text"
						bind:value={manualSlug}
						placeholder="contoh: catatan-penting"
						class="flex-1 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-subtle)] px-3 py-1.5 text-xs font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--text-primary)]"
					/>
					<button
						type="submit"
						class="rounded-xl bg-[var(--text-primary)] px-4 py-1.5 text-xs font-medium text-[var(--bg-surface)] transition-opacity hover:opacity-90 active:scale-[0.98]"
					>
						Gunakan
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
