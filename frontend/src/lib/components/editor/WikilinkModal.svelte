<script lang="ts">
	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onSelect: (slug: string, title?: string) => void;
		availableDocuments?: Array<{ id: string; title: string; slug: string }>;
	}

	let { isOpen, onClose, onSelect, availableDocuments = [] }: Props = $props();

	let searchQuery = $state('');
	let manualSlug = $state('');

	let filteredDocs = $derived.by(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return availableDocuments;
		return availableDocuments.filter(
			(d) => d.title.toLowerCase().includes(q) || d.slug.toLowerCase().includes(q)
		);
	});

	function handlePick(slug: string, title?: string) {
		onSelect(slug, title);
		searchQuery = '';
		manualSlug = '';
		onClose();
	}

	function handleManualSubmit(e: SubmitEvent) {
		e.preventDefault();
		const slugToUse = manualSlug.trim() || searchQuery.trim();
		if (slugToUse) {
			handlePick(slugToUse);
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl transition-all"
		>
			<div class="flex items-center justify-between pb-3 border-b border-gray-100">
				<h3 class="text-base font-semibold text-gray-800 flex items-center gap-1.5">
					<span class="text-emerald-600 font-mono font-bold">[[ ]]</span>
					<span>Sisipkan Wikilink Catatan</span>
				</h3>
				<button
					type="button"
					onclick={onClose}
					class="text-gray-400 hover:text-gray-600 rounded p-1 hover:bg-gray-100 text-lg leading-none"
				>
					&times;
				</button>
			</div>

			<div class="mt-4">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Cari judul catatan atau slug..."
					class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
			</div>

			<!-- List Catatan yang Tersedia -->
			<div
				class="mt-3 max-h-56 overflow-y-auto divide-y divide-gray-100 rounded-md border border-gray-100"
			>
				{#if filteredDocs.length > 0}
					{#each filteredDocs as doc (doc.id)}
						<button
							type="button"
							onclick={() => handlePick(doc.slug, doc.title)}
							class="w-full text-left px-3 py-2 hover:bg-emerald-50/60 transition-colors flex flex-col group"
						>
							<span class="text-sm font-medium text-gray-800 group-hover:text-emerald-800">
								{doc.title}
							</span>
							<span class="text-xs font-mono text-gray-400 group-hover:text-emerald-600">
								[[{doc.slug}]]
							</span>
						</button>
					{/each}
				{:else}
					<div class="p-4 text-center text-xs text-gray-500">
						Tidak ada dokumen yang cocok dengan kata kunci.
					</div>
				{/if}
			</div>

			<!-- Opsi Buat Manual atau slug baru -->
			<form onsubmit={handleManualSubmit} class="mt-4 pt-3 border-t border-gray-100">
				<label for="manual-slug" class="block text-xs font-medium text-gray-600 mb-1">
					Atau gunakan slug / judul baru:
				</label>
				<div class="flex gap-2">
					<input
						id="manual-slug"
						type="text"
						bind:value={manualSlug}
						placeholder="contoh: catatan-penting"
						class="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
					<button
						type="submit"
						class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
					>
						Gunakan
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
