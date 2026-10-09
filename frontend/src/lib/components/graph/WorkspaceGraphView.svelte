<script lang="ts">
	import type { DocumentItem, FolderItem } from '$lib/types';
	import { buildWorkspaceGraphData, getExcerpt } from './graphUtils';
	import type { GraphData, GraphNode, GraphLink } from './types';
	import * as d3 from 'd3';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		documents: DocumentItem[];
		folders?: FolderItem[];
		onSelectDocument?: (doc: DocumentItem) => void;
		onClose?: () => void;
	}

	let { documents = [], folders = [], onSelectDocument, onClose }: Props = $props();

	// Elemen DOM container dan SVG
	let containerElement: HTMLDivElement | null = $state(null);
	let svgElement: SVGSVGElement | null = $state(null);

	// Dimensi canvas responsif
	let width = $state(800);
	let height = $state(540);

	// State interaktif filter & hover
	let searchQuery = $state('');
	let selectedFolder = $state<string | null>(null);
	let hoveredNode = $state<GraphNode | null>(null);
	let popoverPos = $state<{ x: number; y: number; showBelow: boolean }>({
		x: 0,
		y: 0,
		showBelow: false
	});

	// D3 simulation instance
	let simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
	let zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;

	// Susun dataset graph dari daftar dokumen internal
	let graphData = $derived<GraphData>(buildWorkspaceGraphData(documents, folders));

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

	// Truncate label judul node
	function truncateTitle(str: string, max = 20): string {
		if (str.length <= max) return str;
		return str.slice(0, max) + '…';
	}

	// Inisialisasi dan jalankan simulasi D3 Force
	function initSimulation() {
		if (!svgElement || graphData.nodes.length === 0) return;

		if (simulation) {
			simulation.stop();
		}

		const nodes: GraphNode[] = graphData.nodes.map((n) => ({ ...n }));
		const links: GraphLink[] = graphData.links.map((l) => ({
			source: typeof l.source === 'object' ? l.source.id : l.source,
			target: typeof l.target === 'object' ? l.target.id : l.target,
			isFolderRelation: l.isFolderRelation
		}));

		simulation = d3
			.forceSimulation<GraphNode>(nodes)
			.force(
				'link',
				d3
					.forceLink<GraphNode, GraphLink>(links)
					.id((d) => d.id)
					.distance(110)
			)
			.force('charge', d3.forceManyBody().strength(-280))
			.force('center', d3.forceCenter(width / 2, height / 2))
			.force('collision', d3.forceCollide().radius(42))
			.alphaDecay(0.028);

		const svg = d3.select(svgElement);
		svg.selectAll('*').remove();

		// Filter defs untuk drop-shadow visual
		const defs = svg.append('defs');
		const filter = defs.append('filter').attr('id', 'internal-node-shadow').attr('height', '130%');
		filter
			.append('feDropShadow')
			.attr('dx', '0')
			.attr('dy', '2')
			.attr('stdDeviation', '3')
			.attr('flood-opacity', '0.08');

		const g = svg.append('g').attr('class', 'graph-root-group');

		zoomBehavior = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.2, 3.5])
			.on('zoom', (event) => {
				g.attr('transform', event.transform);
			});

		svg.call(zoomBehavior);

		// Layer Garis Penghubung (Links)
		const linkElements = g
			.append('g')
			.attr('class', 'links')
			.selectAll('line')
			.data(links)
			.enter()
			.append('line')
			.attr('stroke', '#cbd5e1')
			.attr('stroke-width', 1.8)
			.attr('stroke-opacity', 0.6)
			.attr('stroke-dasharray', (d) => (d.isFolderRelation ? '3,3' : 'none'));

		// Layer Grup Node
		const nodeGroup = g
			.append('g')
			.attr('class', 'nodes')
			.selectAll('g')
			.data(nodes)
			.enter()
			.append('g')
			.attr('class', 'cursor-pointer')
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

		// Lingkaran Luar (Aura / Border Folder)
		nodeGroup
			.append('circle')
			.attr('r', 22)
			.attr('fill', (d) => d.color.bg)
			.attr('stroke', (d) => d.color.border)
			.attr('stroke-width', 2)
			.attr('filter', 'url(#internal-node-shadow)')
			.attr('class', 'transition-all duration-200');

		// Ikon Emoji Catatan
		nodeGroup
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', 'central')
			.attr('font-size', '16px')
			.attr('pointer-events', 'none')
			.text((d) => d.icon);

		// Label Judul di Bawah Node
		nodeGroup
			.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', 36)
			.attr('font-size', '11px')
			.attr('font-weight', '600')
			.attr('fill', 'var(--text-primary, #18181b)')
			.attr('pointer-events', 'none')
			.text((d) => truncateTitle(d.title));

		// Interaksi Hover dan Klik
		nodeGroup
			.on('mouseenter', (event, d) => {
				hoveredNode = d;
				const rect =
					svgElement?.getBoundingClientRect() || containerElement?.getBoundingClientRect();
				if (rect) {
					const nodeX = event.clientX - rect.left;
					const nodeY = event.clientY - rect.top;
					const isNearTop = nodeY < 150;
					popoverPos = {
						x: Math.min(Math.max(nodeX, 160), width - 160),
						y: isNearTop ? nodeY + 36 : nodeY - 24,
						showBelow: isNearTop
					};
				}
			})
			.on('mouseleave', () => {
				hoveredNode = null;
			})
			.on('click', (_event, d) => {
				const fullDoc = documents.find((doc) => doc.id === d.id);
				if (fullDoc && onSelectDocument) {
					onSelectDocument(fullDoc);
				}
			});

		// Tick Callback D3
		simulation.on('tick', () => {
			linkElements
				.attr('x1', (d) => (d.source as GraphNode).x ?? 0)
				.attr('y1', (d) => (d.source as GraphNode).y ?? 0)
				.attr('x2', (d) => (d.target as GraphNode).x ?? 0)
				.attr('y2', (d) => (d.target as GraphNode).y ?? 0);

			nodeGroup.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
		});
	}

	// Kontrol Zoom
	function handleZoomIn() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(250).call(zoomBehavior.scaleBy, 1.3);
	}

	function handleZoomOut() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement).transition().duration(250).call(zoomBehavior.scaleBy, 0.75);
	}

	function handleResetZoom() {
		if (!svgElement || !zoomBehavior) return;
		d3.select(svgElement)
			.transition()
			.duration(350)
			.call(zoomBehavior.transform, d3.zoomIdentity.translate(0, 0).scale(1));
	}

	// Update dimensi saat container resize
	function updateDimensions() {
		if (containerElement) {
			width = containerElement.clientWidth || 800;
			height = containerElement.clientHeight || 540;
		}
	}

	$effect(() => {
		updateDimensions();
		const handleResize = () => {
			updateDimensions();
			if (simulation) {
				simulation.force('center', d3.forceCenter(width / 2, height / 2));
				simulation.alpha(0.3).restart();
			}
		};
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Re-run simulasi saat data dokumen / svg berubah, dan pastikan cleanup simulation saat unmount
	$effect(() => {
		if (svgElement && graphData) {
			initSimulation();
		}

		return () => {
			if (simulation) {
				simulation.stop();
				simulation = null;
			}
		};
	});

	// Efek visual highlight node saat hover / filter
	$effect(() => {
		if (!svgElement) return;
		const svg = d3.select(svgElement);

		svg.selectAll('.nodes g').each(function (d) {
			const node = d as GraphNode;
			const isHovered = hoveredNode?.id === node.id;
			const isNeighbor = neighborNodeIds.has(node.id);
			const isMatched = filteredNodeIds.has(node.id);

			let opacity = 1;
			if (hoveredNode) {
				opacity = isHovered || isNeighbor ? 1 : 0.18;
			} else if (searchQuery || selectedFolder) {
				opacity = isMatched ? 1 : 0.15;
			}

			d3.select(this)
				.transition()
				.duration(120)
				.attr('opacity', opacity)
				.select('circle')
				.attr('r', isHovered ? 26 : 22)
				.attr('stroke-width', isHovered ? 3 : 2);
		});

		svg.selectAll('.links line').each(function (d) {
			const link = d as GraphLink;
			const sId = typeof link.source === 'object' ? link.source.id : link.source;
			const tId = typeof link.target === 'object' ? link.target.id : link.target;

			let strokeOpacity = 0.6;
			let strokeColor = '#cbd5e1';
			let strokeWidth = 1.8;

			if (hoveredNode) {
				if (sId === hoveredNode.id || tId === hoveredNode.id) {
					strokeOpacity = 1;
					strokeColor = 'var(--text-primary, #0f172a)';
					strokeWidth = 2.5;
				} else {
					strokeOpacity = 0.08;
				}
			}

			d3.select(this)
				.transition()
				.duration(120)
				.attr('stroke-opacity', strokeOpacity)
				.attr('stroke', strokeColor)
				.attr('stroke-width', strokeWidth);
		});
	});
</script>

<div
	bind:this={containerElement}
	class="relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-[var(--bg-surface)] text-[var(--text-primary)]"
	data-testid="workspace-graph-view"
>
	<!-- Top Bar Kontrol & Filter -->
	<div
		class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-app-subtle)] bg-[var(--bg-surface-subtle)]/60 px-5 py-3 backdrop-blur-sm"
	>
		<!-- Left: Informasi Ringkas & Judul -->
		<div class="flex items-center gap-2.5">
			<span
				class="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-sm font-bold text-emerald-600"
			>
				🕸️
			</span>
			<div>
				<h3 class="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
					Graf Relasi Dokumen Workspace
				</h3>
				<p class="text-[11px] text-[var(--text-secondary)]">
					{graphData.nodes.length} Catatan • {graphData.links.length} Tautan Wikilink
				</p>
			</div>
		</div>

		<!-- Right: Input Pencarian, Zoom & Tombol Tutup -->
		<div class="flex items-center gap-2">
			<!-- Input Pencarian Langsung -->
			<div class="relative w-44 sm:w-56">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Saring simpul..."
					class="w-full rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] py-1.5 pr-2.5 pl-7 text-xs text-[var(--text-primary)] shadow-input placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
				/>
				<svg
					class="absolute top-2 left-2.5 h-3.5 w-3.5 text-[var(--text-muted)]"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
			</div>

			<!-- Zoom Controls -->
			<div
				class="flex items-center overflow-hidden rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] shadow-input"
			>
				<button
					type="button"
					onclick={handleZoomIn}
					class="px-2 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
					title="Perbesar"
				>
					+
				</button>
				<button
					type="button"
					onclick={handleZoomOut}
					class="border-l border-[var(--border-app)] px-2 py-1.5 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
					title="Perkecil"
				>
					−
				</button>
				<button
					type="button"
					onclick={handleResetZoom}
					class="border-l border-[var(--border-app)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
					title="Reset tampilan"
				>
					Reset
				</button>
			</div>

			{#if onClose}
				<button
					type="button"
					onclick={onClose}
					class="rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-input transition-all hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] active:scale-[0.98]"
					title="Kembali ke Editor"
				>
					✕ Tutup
				</button>
			{/if}
		</div>
	</div>

	<!-- Folder Pills Filter Bar -->
	{#if graphData.folders.length > 0}
		<div
			class="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-app-subtle)] bg-[var(--bg-surface)] px-5 py-2"
		>
			<span class="text-[11px] font-medium text-[var(--text-muted)]">Folder:</span>
			<button
				type="button"
				onclick={() => (selectedFolder = null)}
				class="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors {!selectedFolder
					? 'bg-[var(--text-primary)] text-[var(--bg-surface)]'
					: 'bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
			>
				Semua ({graphData.nodes.length})
			</button>
			{#each graphData.folders as folder (folder.name)}
				<button
					type="button"
					onclick={() => (selectedFolder = selectedFolder === folder.name ? null : folder.name)}
					class="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all {selectedFolder ===
					folder.name
						? 'ring-2 ring-emerald-500'
						: 'hover:opacity-90'}"
					style="background-color: {folder.color.bg}; border-color: {folder.color
						.border}; color: {folder.color.text};"
				>
					<span
						class="inline-block h-1.5 w-1.5 rounded-full"
						style="background-color: {folder.color.dot};"
					></span>
					<span>{folder.name}</span>
					<span class="opacity-75">({folder.count})</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Canvas Area SVG -->
	<div class="relative flex-1 bg-[var(--bg-surface)]">
		{#if graphData.nodes.length === 0}
			<div class="flex h-full flex-col items-center justify-center p-8 text-center">
				<div class="mb-3 rounded-2xl bg-[var(--bg-surface-subtle)] p-4 text-3xl">🕸️</div>
				<h4 class="text-sm font-semibold text-[var(--text-primary)]">
					Belum Ada Catatan untuk Ditampilkan
				</h4>
				<p class="mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
					Buat catatan dan tautkan dengan sintaks <code class="font-mono text-emerald-600"
						>[[nama-catatan]]</code
					> untuk mulai melihat jaringan keterkaitan.
				</p>
			</div>
		{:else}
			<svg
				bind:this={svgElement}
				class="h-full w-full cursor-grab active:cursor-grabbing"
				style="touch-action: none;"
			></svg>

			<!-- Hover Tooltip Popover -->
			{#if hoveredNode}
				<div
					class="pointer-events-none absolute z-20 w-72 -translate-x-1/2 rounded-2xl border border-[var(--border-app)] bg-[var(--bg-surface)] p-3.5 shadow-xl transition-all {popoverPos.showBelow
						? ''
						: '-translate-y-full'}"
					style="left: {popoverPos.x}px; top: {popoverPos.y}px;"
				>
					<div class="flex items-start gap-2.5">
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base shadow-2xs"
							style="background-color: {hoveredNode.color.bg}; border: 1px solid {hoveredNode.color
								.border};"
						>
							{hoveredNode.icon}
						</span>
						<div class="min-w-0 flex-1">
							<h4 class="truncate text-sm font-bold text-[var(--text-primary)]">
								{hoveredNode.title}
							</h4>
							<div
								class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
							>
								{#if hoveredNode.folder_name}
									<span
										class="rounded px-1.5 py-0.5 font-medium"
										style="background-color: {hoveredNode.color.bg}; color: {hoveredNode.color
											.text};"
									>
										{hoveredNode.folder_name}
									</span>
								{/if}
								<span class="font-mono text-[10px] text-[var(--text-muted)]">
									[[{hoveredNode.slug}]]
								</span>
							</div>
						</div>
					</div>

					<p class="mt-2 text-xs leading-relaxed text-[var(--text-secondary)] line-clamp-3">
						{getExcerpt(hoveredNode.content)}
					</p>

					<div
						class="mt-2.5 flex items-center justify-between border-t border-[var(--border-app-subtle)] pt-2 text-[10px] text-[var(--text-muted)]"
					>
						<span>{hoveredNode.connections} koneksi wikilink</span>
						<span class="font-medium text-emerald-600">Klik untuk buka catatan</span>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>
