<script lang="ts">
	import type { PublicDocumentItem } from '$lib/types';
	import { buildGraphData, getExcerpt } from './graphUtils';
	import type { GraphData, GraphNode, GraphLink } from './types';
	import * as d3 from 'd3';
	import { SvelteSet } from 'svelte/reactivity';

	let {
		documents = [],
		onSelectDocument
	}: {
		documents: PublicDocumentItem[];
		onSelectDocument?: (doc: PublicDocumentItem) => void;
	} = $props();

	// Elemen DOM container dan SVG
	let containerElement: HTMLDivElement | null = $state(null);
	let svgElement: SVGSVGElement | null = $state(null);

	// Dimensi canvas
	let width = $state(800);
	let height = $state(520);

	// State interaktif
	let searchQuery = $state('');
	let selectedFolder = $state<string | null>(null);
	let hoveredNode = $state<GraphNode | null>(null);
	let popoverPos = $state<{ x: number; y: number }>({ x: 0, y: 0 });

	// D3 simulation instance
	let simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
	let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;

	// Olah data dari props documents
	let graphData = $derived<GraphData>(buildGraphData(documents));

	// Tentukan node yang cocok dengan filter / pencarian
	let filteredNodeIds = $derived.by(() => {
		const set = new SvelteSet<string>();
		const q = searchQuery.toLowerCase().trim();

		for (const node of graphData.nodes) {
			const matchesFolder =
				!selectedFolder || (node.folder_name?.trim() || 'Tanpa Folder') === selectedFolder;
			const matchesQuery =
				!q ||
				node.title.toLowerCase().includes(q) ||
				(node.content && node.content.toLowerCase().includes(q));

			if (matchesFolder && matchesQuery) {
				set.add(node.id);
			}
		}
		return set;
	});

	// Hitung node yang terhubung dengan hoveredNode
	let neighborNodeIds = $derived.by(() => {
		const set = new SvelteSet<string>();
		if (!hoveredNode) return set;
		set.add(hoveredNode.id);

		for (const link of graphData.links) {
			const sId = typeof link.source === 'object' ? link.source.id : link.source;
			const tId = typeof link.target === 'object' ? link.target.id : link.target;
			if (sId === hoveredNode.id) {
				set.add(tId);
			} else if (tId === hoveredNode.id) {
				set.add(sId);
			}
		}
		return set;
	});

	// Formatting tanggal singkat
	function formatShortDate(dateStr: string | null): string {
		if (!dateStr) return '';
		const d = new Date(dateStr);
		return d.toLocaleDateString('id-ID', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	// Truncate label judul node
	function truncateTitle(str: string, max = 18): string {
		if (str.length <= max) return str;
		return str.slice(0, max) + '…';
	}

	// Inisialisasi dan jalankan simulasi D3 Force
	function initSimulation() {
		if (!svgElement || graphData.nodes.length === 0) return;

		// Hentikan simulasi lama jika ada
		if (simulation) {
			simulation.stop();
		}

		// Siapkan deep copy data agar D3 bisa memutasi x, y, vx, vy
		const nodes: GraphNode[] = graphData.nodes.map((n) => ({ ...n }));

		const links: GraphLink[] = graphData.links.map((l) => ({
			source: typeof l.source === 'object' ? l.source.id : l.source,
			target: typeof l.target === 'object' ? l.target.id : l.target,
			isFolderRelation: l.isFolderRelation
		}));

		// Inisialisasi force simulation
		simulation = d3
			.forceSimulation<GraphNode>(nodes)
			.force(
				'link',
				d3
					.forceLink<GraphNode, GraphLink>(links)
					.id((d) => d.id)
					.distance(100)
			)
			.force('charge', d3.forceManyBody().strength(-240))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide().radius(36))
			.alphaDecay(0.028);

		// Siapkan seleksi D3 untuk link dan node
		const svg = d3.select(svgElement);
		const gZoom = svg.select<SVGGElement>('g.zoom-container');

		// Bersihkan elemen sebelumnya di dalam gZoom jika ada
		gZoom.selectAll('*').remove();

		// Buat container grup untuk links dan nodes
		const linkGroup = gZoom.append('g').attr('class', 'links-layer');
		const nodeGroup = gZoom.append('g').attr('class', 'nodes-layer');

		// Render Garis Hubungan (Links)
		const linkElements = linkGroup
			.selectAll<SVGLineElement, GraphLink>('line')
			.data(links)
			.enter()
			.append('line')
			.attr('stroke', '#cbd5e1')
			.attr('stroke-width', 1.5)
			.attr('stroke-dasharray', (d) => (d.isFolderRelation ? '3,3' : 'none'))
			.attr('stroke-opacity', 0.6);

		// Render Nodes (Grup Lingkaran + Ikon + Teks)
		const nodeElements = nodeGroup
			.selectAll<SVGGElement, GraphNode>('g.node')
			.data(nodes)
			.enter()
			.append('g')
			.attr('class', 'node cursor-pointer select-none')
			.call(
				d3
					.drag<SVGGElement, GraphNode>()
					.on('start', (event, d) => {
						if (!event.active && simulation) simulation.alphaTarget(0.3).restart();
						d.fx = d.x;
						d.fy = d.y;
					})
					.on('drag', (event, d) => {
						d.fx = event.x;
						d.fy = event.y;
					})
					.on('end', (event, d) => {
						if (!event.active && simulation) simulation.alphaTarget(0);
						d.fx = null;
						d.fy = null;
					})
			);

		// Lingkaran luar berbayang
		nodeElements
			.append('circle')
			.attr('r', 22)
			.attr('fill', (d) => d.color.bg)
			.attr('stroke', (d) => d.color.border)
			.attr('stroke-width', 2.5)
			.attr('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.08))')
			.attr('class', 'transition-transform duration-150');

		// Ikon Emoji di tengah lingkaran
		nodeElements
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('font-size', '16px')
			.attr('pointer-events', 'none')
			.text((d) => d.icon);

		// Label judul dokumen di bawah lingkaran
		nodeElements
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', 34)
			.attr('font-size', '11px')
			.attr('font-weight', '600')
			.attr('fill', '#334155')
			.attr('pointer-events', 'none')
			.text((d) => truncateTitle(d.title));

		// Badge kategori folder kecil di atas lingkaran jika ada
		nodeElements
			.filter((d) => !!d.folder_name)
			.append('circle')
			.attr('cx', 15)
			.attr('cy', -15)
			.attr('r', 5)
			.attr('fill', (d) => d.color.border)
			.attr('stroke', '#ffffff')
			.attr('stroke-width', 1.5)
			.attr('pointer-events', 'none');

		// Interaksi Hover & Click pada node
		nodeElements
			.on('mouseenter', (event: MouseEvent, d: GraphNode) => {
				hoveredNode = d;
				updateNodePopoverPosition(event);

				// Highlight visual links yang terhubung
				linkElements
					.attr('stroke', (l) => {
						const s = typeof l.source === 'object' ? l.source.id : l.source;
						const t = typeof l.target === 'object' ? l.target.id : l.target;
						return s === d.id || t === d.id ? d.color.border : '#cbd5e1';
					})
					.attr('stroke-width', (l) => {
						const s = typeof l.source === 'object' ? l.source.id : l.source;
						const t = typeof l.target === 'object' ? l.target.id : l.target;
						return s === d.id || t === d.id ? 2.5 : 1;
					})
					.attr('stroke-opacity', (l) => {
						const s = typeof l.source === 'object' ? l.source.id : l.source;
						const t = typeof l.target === 'object' ? l.target.id : l.target;
						return s === d.id || t === d.id ? 1 : 0.25;
					});
			})
			.on('mousemove', (event: MouseEvent) => {
				updateNodePopoverPosition(event);
			})
			.on('mouseleave', () => {
				hoveredNode = null;
				// Kembalikan styling link normal
				linkElements
					.attr('stroke', '#cbd5e1')
					.attr('stroke-width', 1.5)
					.attr('stroke-opacity', 0.6);
			})
			.on('click', (_event: MouseEvent, d: GraphNode) => {
				const originalDoc = documents.find((doc) => doc.id === d.id);
				if (originalDoc && onSelectDocument) {
					onSelectDocument(originalDoc);
				}
			});

		// Pasang behavior Zoom dan Pan
		zoomBehavior = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.3, 3])
			.on('zoom', (event) => {
				gZoom.attr('transform', event.transform.toString());
			});

		svg.call(zoomBehavior);

		// Tick update per frame
		simulation.on('tick', () => {
			linkElements
				.attr('x1', (d) => (typeof d.source === 'object' ? (d.source as GraphNode).x || 0 : 0))
				.attr('y1', (d) => (typeof d.source === 'object' ? (d.source as GraphNode).y || 0 : 0))
				.attr('x2', (d) => (typeof d.target === 'object' ? (d.target as GraphNode).x || 0 : 0))
				.attr('y2', (d) => (typeof d.target === 'object' ? (d.target as GraphNode).y || 0 : 0));

			nodeElements.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
		});
	}

	// Update posisi popover summary saat hover
	function updateNodePopoverPosition(event: MouseEvent) {
		const targetEl = svgElement || containerElement;
		if (!targetEl) return;
		const rect = targetEl.getBoundingClientRect();
		popoverPos = {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}

	// Controls Zoom
	function handleZoomIn() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(250).call(zoomBehavior.scaleBy, 1.3);
	}

	function handleZoomOut() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(250).call(zoomBehavior.scaleBy, 0.7);
	}

	function handleResetZoom() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(350).call(zoomBehavior.transform, d3.zoomIdentity);
	}
	// Update visual opacity node saat search atau filter folder berubah
	$effect(() => {
		if (!svgElement) return;
		const svg = d3.select(svgElement);
		svg.selectAll<SVGGElement, GraphNode>('g.node').each(function (d) {
			const isMatched = filteredNodeIds.has(d.id);
			const isNeighbor = neighborNodeIds.size === 0 || neighborNodeIds.has(d.id);
			const opacity = isMatched && isNeighbor ? 1 : 0.2;
			d3.select(this).style('opacity', opacity.toString());
		});
	});

	// Tangani perubahan ukuran layar (ResizeObserver)
	$effect(() => {
		if (!containerElement) return;
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const cr = entry.contentRect;
				if (cr.width > 0) {
					width = cr.width;
				}
			}
		});
		ro.observe(containerElement);

		return () => {
			ro.disconnect();
		};
	});

	// Re-run simulasi saat graphData atau dimensi berubah
	$effect(() => {
		// Akses graphData untuk tracking dependensi
		void graphData;
		if (width > 0 && height > 0) {
			initSimulation();
		}

		return () => {
			if (simulation) simulation.stop();
		};
	});
</script>

<div
	bind:this={containerElement}
	class="relative flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
>
	<!-- Bar Kontrol Atas (Pencarian, Filter Folder, Indikator) -->
	<div
		class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50/70 px-4 py-2.5 text-xs"
	>
		<div class="flex items-center gap-2">
			<span class="font-bold text-neutral-800">Grafik Pengetahuan Publik</span>
			<span class="rounded-full bg-neutral-200 px-2 py-0.5 font-medium text-neutral-600">
				{graphData.nodes.length} Catatan
			</span>
			<span class="rounded-full bg-neutral-200 px-2 py-0.5 font-medium text-neutral-600">
				{graphData.links.length} Tautan
			</span>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<!-- Input Pencarian Cepat -->
			<div class="relative">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Cari catatan dalam graf..."
					class="w-44 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs text-neutral-800 placeholder-neutral-400 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-400 sm:w-56"
				/>
				{#if searchQuery}
					<button
						type="button"
						onclick={() => (searchQuery = '')}
						class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
						title="Hapus pencarian"
					>
						✕
					</button>
				{/if}
			</div>

			<!-- Tombol Kontrol Zoom -->
			<div class="flex items-center rounded-md border border-neutral-200 bg-white shadow-xs">
				<button
					type="button"
					onclick={handleZoomIn}
					class="px-2 py-1 font-bold text-neutral-600 hover:bg-neutral-100"
					title="Perbesar"
				>
					+
				</button>
				<button
					type="button"
					onclick={handleZoomOut}
					class="border-l border-neutral-200 px-2 py-1 font-bold text-neutral-600 hover:bg-neutral-100"
					title="Perkecil"
				>
					−
				</button>
				<button
					type="button"
					onclick={handleResetZoom}
					class="border-l border-neutral-200 px-2.5 py-1 font-medium text-neutral-600 hover:bg-neutral-100"
					title="Reset posisi tampilan"
				>
					Reset
				</button>
			</div>
		</div>
	</div>

	<!-- Bar Legend Folder -->
	{#if graphData.folders.length > 0}
		<div class="flex flex-wrap items-center gap-1.5 border-b border-neutral-100 bg-white px-4 py-2">
			<span class="text-[11px] font-medium text-neutral-400">Folder:</span>
			<button
				type="button"
				onclick={() => (selectedFolder = null)}
				class="rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors {!selectedFolder
					? 'bg-neutral-900 text-white'
					: 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}"
			>
				Semua
			</button>
			{#each graphData.folders as folder (folder.name)}
				<button
					type="button"
					onclick={() => (selectedFolder = selectedFolder === folder.name ? null : folder.name)}
					class="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all {selectedFolder ===
					folder.name
						? 'ring-2 ring-neutral-400'
						: 'hover:opacity-85'}"
					style="background-color: {folder.color.bg}; border-color: {folder.color
						.border}; color: {folder.color.text};"
				>
					<span class="h-2 w-2 rounded-full" style="background-color: {folder.color.border};"
					></span>
					<span>{folder.name}</span>
					<span class="opacity-70">({folder.count})</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Area Grafik SVG Utama -->
	<div class="relative h-[520px] w-full bg-neutral-50/50">
		{#if graphData.nodes.length === 0}
			<div
				class="flex h-full flex-col items-center justify-center p-8 text-center text-neutral-500"
			>
				<p class="text-sm font-semibold text-neutral-700">Belum Ada Node Grafik</p>
				<p class="mt-1 text-xs text-neutral-400">
					Menerbitkan catatan publik akan membentuk simpul pada grafik pengetahuan ini.
				</p>
			</div>
		{:else}
			<svg bind:this={svgElement} {width} {height} class="h-full w-full select-none">
				<g class="zoom-container"></g>
			</svg>

			<!-- Popover Hover Summary (Acceptance Criteria: Hover node -> popover summary 150 char pertama) -->
			{#if hoveredNode}
				{@const showBelow = popoverPos.y < 160}
				<div
					class="pointer-events-none absolute z-30 w-72 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white/95 p-3.5 shadow-lg backdrop-blur-xs transition-all {showBelow
						? 'translate-y-4'
						: '-translate-y-full'}"
					style="left: {Math.max(150, Math.min(width - 150, popoverPos.x))}px; top: {showBelow
						? Math.min(height - 180, popoverPos.y + 12)
						: Math.max(10, popoverPos.y - 12)}px;"
				>
					<div class="flex items-start gap-2.5">
						<span class="text-2xl">{hoveredNode.icon}</span>
						<div class="min-w-0 flex-1">
							<h4 class="truncate text-sm font-bold text-neutral-900">
								{hoveredNode.title}
							</h4>
							<div class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
								{#if hoveredNode.folder_name}
									<span
										class="rounded px-1.5 py-0.2 font-medium"
										style="background-color: {hoveredNode.color.bg}; color: {hoveredNode.color
											.text};"
									>
										{hoveredNode.folder_name}
									</span>
								{/if}
								{#if hoveredNode.published_at}
									<span>{formatShortDate(hoveredNode.published_at)}</span>
								{/if}
							</div>
						</div>
					</div>

					<!-- Ringkasan Konten 150 Karakter Pertama -->
					<p class="mt-2 text-xs leading-relaxed text-neutral-600">
						{getExcerpt(hoveredNode.content, 150)}
					</p>

					<div
						class="mt-2.5 flex items-center justify-between border-t border-neutral-100 pt-2 text-[10px] text-neutral-400"
					>
						<span>{hoveredNode.connections} koneksi wikilink</span>
						<span class="font-medium text-neutral-600">Klik untuk melihat catatan</span>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Keterangan Navigasi di Footer Grafik -->
	<div
		class="flex items-center justify-between border-t border-neutral-100 bg-white px-4 py-2 text-[11px] text-neutral-400"
	>
		<div class="flex items-center gap-3">
			<span
				>💡 <strong>Tips:</strong> Geser mouse untuk menggeser kanvas, gunakan roda mouse untuk zoom,
				dan seret simpul untuk mengatur letak.</span
			>
		</div>
		<span>Max 100 Simpul</span>
	</div>
</div>
