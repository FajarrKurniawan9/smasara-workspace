import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface FolderColor {
	bg: string;
	border: string;
	text: string;
	dot: string;
}

export interface GraphNode extends SimulationNodeDatum {
	id: string;
	title: string;
	slug: string;
	folder_name: string | null;
	content: string | null;
	published_at: string | null;
	icon: string;
	color: FolderColor;
	connections: number;
	x?: number;
	y?: number;
	vx?: number;
	vy?: number;
	fx?: number | null;
	fy?: number | null;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
	source: string | GraphNode;
	target: string | GraphNode;
	isFolderRelation?: boolean;
}

export interface GraphData {
	nodes: GraphNode[];
	links: GraphLink[];
	folders: { name: string; count: number; color: FolderColor }[];
}
