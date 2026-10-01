import type { PublicDocumentItem } from '$lib/types';
import type { FolderColor, GraphData, GraphLink, GraphNode } from './types';

export const FOLDER_PALETTE: FolderColor[] = [
	{ bg: '#e0f2fe', border: '#0284c7', text: '#0369a1', dot: '#38bdf8' }, // Sky
	{ bg: '#dcfce7', border: '#16a34a', text: '#15803d', dot: '#4ade80' }, // Emerald
	{ bg: '#fef3c7', border: '#d97706', text: '#b45309', dot: '#fbbf24' }, // Amber
	{ bg: '#ede9fe', border: '#7c3aed', text: '#6d28d9', dot: '#a78bfa' }, // Purple
	{ bg: '#ffe4e6', border: '#e11d48', text: '#be123c', dot: '#fb7185' }, // Rose
	{ bg: '#ccfbf1', border: '#0d9488', text: '#0f766e', dot: '#2dd4bf' }, // Teal
	{ bg: '#ffedd5', border: '#ea580c', text: '#c2410c', dot: '#fb923c' }, // Orange
	{ bg: '#e0e7ff', border: '#4f46e5', text: '#4338ca', dot: '#818cf8' }, // Indigo
	{ bg: '#fae8ff', border: '#c026d3', text: '#a21caf', dot: '#e879f9' } // Fuchsia
];

export const DEFAULT_FOLDER_COLOR: FolderColor = {
	bg: '#f1f5f9',
	border: '#64748b',
	text: '#475569',
	dot: '#94a3b8'
};

/**
 * Ekstrak emoji pertama dari judul dokumen, fallback ke icon catatan.
 */
export function extractFirstEmoji(title: string): string {
	if (!title) return '📄';
	const match = title.match(/(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u);
	if (match && match[0]) {
		return match[0];
	}
	return '📄';
}

/**
 * Buat ringkasan teks bersih untuk popover hover (maksimal 150 karakter).
 */
export function getExcerpt(content: string | null, maxLength = 150): string {
	if (!content) return 'Tidak ada ringkasan catatan.';
	const plain = content
		.replace(/^#+\s+/gm, '')
		.replace(/\[\[(?:[^\]|]+\|)?(.*?)\]\]/g, '$1')
		.replace(/[*_`~>#]/g, '')
		.replace(/\n+/g, ' ')
		.trim();
	if (!plain) return 'Tidak ada ringkasan catatan.';
	if (plain.length <= maxLength) return plain;
	return plain.slice(0, maxLength).trim() + '...';
}

/**
 * Susun dataset graf berarah dari daftar dokumen publik (dibatasi max 100 node sesuai spesifikasi T-503).
 */
export function buildGraphData(documents: PublicDocumentItem[]): GraphData {
	// Batasi maksimal 100 node
	const cappedDocs = (documents || []).slice(0, 100);

	// Kumpulkan folder unik dan tetapkan warna
	const folderMap = new Map<string, FolderColor>();
	const folderCount = new Map<string, number>();
	let colorIndex = 0;

	for (const doc of cappedDocs) {
		const folderName = doc.folder_name?.trim() || 'Tanpa Folder';
		folderCount.set(folderName, (folderCount.get(folderName) || 0) + 1);

		if (!folderMap.has(folderName)) {
			if (folderName === 'Tanpa Folder') {
				folderMap.set(folderName, DEFAULT_FOLDER_COLOR);
			} else {
				folderMap.set(folderName, FOLDER_PALETTE[colorIndex % FOLDER_PALETTE.length]);
				colorIndex++;
			}
		}
	}

	// Buat index pencarian untuk resolusi wikilink [[slug]] atau [[title]]
	const docBySlug = new Map<string, PublicDocumentItem>();
	const docByTitle = new Map<string, PublicDocumentItem>();
	const docById = new Map<string, PublicDocumentItem>();

	for (const doc of cappedDocs) {
		docById.set(doc.id, doc);
		if (doc.slug) {
			docBySlug.set(doc.slug.toLowerCase().trim(), doc);
		}
		if (doc.title) {
			docByTitle.set(doc.title.toLowerCase().trim(), doc);
		}
	}

	// Hitung koneksi dan bentuk tautan (links)
	const links: GraphLink[] = [];
	const linkPairSet = new Set<string>();
	const connectionCounts = new Map<string, number>();

	for (const doc of cappedDocs) {
		if (!doc.content) continue;
		const matches = Array.from(doc.content.matchAll(/\[\[(.*?)\]\]/g));
		for (const match of matches) {
			const rawTarget = match[1]?.trim();
			if (!rawTarget) continue;
			// Dukung [[slug]] atau [[slug|label alias]]
			const targetKey = (rawTarget.split('|')[0] || '').toLowerCase().trim();
			if (!targetKey) continue;
			const targetDoc = docBySlug.get(targetKey) || docByTitle.get(targetKey);
			if (targetDoc && targetDoc.id !== doc.id) {
				// Hindari duplicate link
				const pairKey = [doc.id, targetDoc.id].sort().join(':::');
				if (!linkPairSet.has(pairKey)) {
					linkPairSet.add(pairKey);
					links.push({
						source: doc.id,
						target: targetDoc.id,
						isFolderRelation: false
					});

					connectionCounts.set(doc.id, (connectionCounts.get(doc.id) || 0) + 1);
					connectionCounts.set(targetDoc.id, (connectionCounts.get(targetDoc.id) || 0) + 1);
				}
			}
		}
	}

	// Bentuk array nodes
	const nodes: GraphNode[] = cappedDocs.map((doc) => {
		const folderName = doc.folder_name?.trim() || 'Tanpa Folder';
		const color = folderMap.get(folderName) || DEFAULT_FOLDER_COLOR;
		return {
			id: doc.id,
			title: doc.title,
			slug: doc.slug,
			folder_name: doc.folder_name,
			content: doc.content,
			published_at: doc.published_at,
			icon: extractFirstEmoji(doc.title),
			color,
			connections: connectionCounts.get(doc.id) || 0
		};
	});

	// Rangkum daftar folder untuk filter / legend
	const folders = Array.from(folderMap.entries()).map(([name, color]) => ({
		name,
		count: folderCount.get(name) || 0,
		color
	}));

	return { nodes, links, folders };
}
