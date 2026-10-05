<script lang="ts">
	import type { RelatedNoteItem } from '$lib/types';
	import { slide } from 'svelte/transition';

	let {
		relatedNotes = [],
		isLoading = false,
		onSelect
	}: {
		relatedNotes: RelatedNoteItem[];
		isLoading: boolean;
		onSelect: (docId: string) => void;
	} = $props();

	let isCollapsed = $state(false);

	function getRelationBadge(weight: number): {
		label: string;
		bg: string;
		text: string;
		title: string;
	} {
		if (Math.abs(weight - 1.0) < 0.001) {
			return {
				label: 'Tautan',
				bg: 'bg-indigo-50 border-indigo-200',
				text: 'text-indigo-700',
				title: 'Ditautkan langsung via [[wikilink]] (Skor: 1.0)'
			};
		}
		if (Math.abs(weight - 0.5) < 0.001) {
			return {
				label: 'Satu Folder',
				bg: 'bg-emerald-50 border-emerald-200',
				text: 'text-emerald-700',
				title: 'Berada di dalam folder yang sama (Skor: 0.5)'
			};
		}
		const pct = Math.round(weight * 100);
		return {
			label: `${pct}% Mirip`,
			bg: 'bg-amber-50 border-amber-200',
			text: 'text-amber-700',
			title: `Kemiripan judul trigram: ${pct}%`
		};
	}
</script>

<div class="mt-8 border-t border-gray-100 pt-6" data-testid="related-notes-section">
	<div class="flex items-center justify-between mb-3">
		<div class="flex items-center gap-2">
			<svg
				class="w-4 h-4 text-emerald-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
				/>
			</svg>
			<h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500">
				Catatan Terkait & Rekomendasi
			</h3>
			{#if !isLoading && relatedNotes.length > 0}
				<span class="text-[11px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
					{relatedNotes.length}
				</span>
			{/if}
		</div>
		<button
			type="button"
			onclick={() => (isCollapsed = !isCollapsed)}
			class="text-xs text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100 transition-colors flex items-center gap-1"
			aria-label={isCollapsed ? 'Buka panel rekomendasi' : 'Tutup panel rekomendasi'}
			aria-expanded={!isCollapsed}
			aria-controls="related-notes-content"
		>
			<span class="text-[11px] hidden sm:inline">{isCollapsed ? 'Tampilkan' : 'Sembunyikan'}</span>
			<svg
				class="w-3.5 h-3.5 transform transition-transform duration-200 {isCollapsed
					? '-rotate-90'
					: 'rotate-0'}"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
			</svg>
		</button>
	</div>

	{#if !isCollapsed}
		<div id="related-notes-content" transition:slide={{ duration: 150 }}>
			{#if isLoading}
				<div class="py-6 flex items-center justify-center gap-2 text-xs text-gray-400">
					<span
						class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-emerald-600 border-t-2 border-transparent"
					></span>
					<span>Mencari catatan terkait...</span>
				</div>
			{:else if relatedNotes.length === 0}
				<div
					class="py-4 px-3 bg-gray-50/60 rounded-xl border border-dashed border-gray-200 text-center"
				>
					<p class="text-xs text-gray-400">
						Belum ada catatan yang terhubung atau mirip dengan dokumen ini.
					</p>
					<p class="text-[11px] text-gray-400 mt-1">
						Tip: Tautkan menggunakan <span
							class="font-mono bg-white px-1 py-0.5 rounded border border-gray-200"
							>[[nama-catatan]]</span
						> untuk menghubungkannya langsung.
					</p>
				</div>
			{:else}
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					{#each relatedNotes as note (note.id)}
						{@const badge = getRelationBadge(note.weight)}
						<button
							type="button"
							onclick={() => onSelect(note.id)}
							class="group flex flex-col justify-between p-3 rounded-xl border border-gray-100 bg-white hover:border-emerald-200 hover:shadow-xs transition-all text-left"
						>
							<div class="flex items-start justify-between gap-2 mb-1.5 w-full">
								<span
									class="text-xs font-medium text-gray-800 group-hover:text-emerald-700 transition-colors line-clamp-1"
									title={note.title}
								>
									{note.title || 'Tanpa Judul'}
								</span>
								<span
									data-testid="relation-badge"
									class="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border {badge.bg} {badge.text}"
									title={badge.title}
								>
									{badge.label}
								</span>
							</div>
							<div class="flex items-center text-[10px] text-gray-400 font-mono">
								<span class="truncate">/{note.slug}</span>
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
