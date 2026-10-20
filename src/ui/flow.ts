import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { StrategyDoc, StrategyEdge } from '../model/strategy';
import type { EdgeId, NodeId } from '../model/strategy';

export type Selection = { type: 'node'; id: NodeId } | { type: 'edge'; id: EdgeId } | null;

export type StrategyNodeData = { name: string; isRoot: boolean; isEnd: boolean; mediaCount: number };
export type StrategyFlowNode = Node<StrategyNodeData, 'strategy'>;
export type StrategyEdgeData = { label: string; mediaCount: number };
export type StrategyFlowEdge = Edge<StrategyEdgeData, 'strategy'>;
export type Size = { width: number; height: number };

const GRID_COLUMNS = 4;
const GRID_X = 240;
const GRID_Y = 150;

function autoPosition(index: number) {
	return { x: (index % GRID_COLUMNS) * GRID_X, y: Math.floor(index / GRID_COLUMNS) * GRID_Y };
}

function clipCount(count: number): string {
	return count === 1 ? '1 clip' : `${count} clips`;
}

export function nodeAriaLabel(name: string, isRoot: boolean, mediaCount: number, isEnd: boolean): string {
	const parts = [name || 'Untitled'];
	if (isRoot) parts.push('start');
	if (mediaCount > 0) parts.push(clipCount(mediaCount));
	if (isEnd) parts.push('line ends');
	return parts.join(', ');
}

export function edgeAriaLabel(doc: StrategyDoc, edge: StrategyEdge): string {
	const from = doc.nodes[edge.from]?.name || 'Untitled';
	const to = doc.nodes[edge.to]?.name || 'Untitled';
	const parts = [`${from} to ${to}`];
	if (edge.label !== '') parts.push(`reaction: ${edge.label}`);
	if (edge.media.length > 0) parts.push(clipCount(edge.media.length));
	return parts.join(', ');
}

export function toFlowNodes(
	doc: StrategyDoc,
	selection: Selection,
	measured: Record<string, Size>,
): StrategyFlowNode[] {
	const hasOutgoing = new Set(Object.values(doc.edges).map((edge) => edge.from));
	return Object.values(doc.nodes).map((node, index) => {
		const size = measured[node.id];
		const isRoot = node.id === doc.rootNodeId;
		const isEnd = !hasOutgoing.has(node.id);
		return {
			id: node.id,
			type: 'strategy',
			ariaLabel: nodeAriaLabel(node.name, isRoot, node.media.length, isEnd),
			position: doc.layout[node.id] ?? autoPosition(index),
			data: {
				name: node.name,
				isRoot,
				isEnd,
				mediaCount: node.media.length,
			},
			selected: selection?.type === 'node' && selection.id === node.id,
			...(size ? { measured: size } : {}),
		};
	});
}

export function toFlowEdges(doc: StrategyDoc, selection: Selection): StrategyFlowEdge[] {
	return Object.values(doc.edges).map((edge) => ({
		id: edge.id,
		type: 'strategy',
		source: edge.from,
		target: edge.to,
		data: { label: edge.label, mediaCount: edge.media.length },
		ariaLabel: edgeAriaLabel(doc, edge),
		markerEnd: { type: MarkerType.ArrowClosed },
		selected: selection?.type === 'edge' && selection.id === edge.id,
	}));
}

export type Point = { x: number; y: number };
export type Rect = Point & Size;

export const NODE_SIZE: Size = { width: 200, height: 90 };
const OVERLAP_STEP = NODE_SIZE.height + 20;

function overlaps(a: Rect, b: Rect): boolean {
	return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

const LABEL_CHAR_WIDTH = 8;
const LABEL_PADDING = 16;
const LABEL_HEIGHT = 32;
const LABEL_MAX_WIDTH = 200;

function nodeRect(node: StrategyFlowNode): Rect {
	return {
		x: node.position.x,
		y: node.position.y,
		width: node.measured?.width ?? NODE_SIZE.width,
		height: node.measured?.height ?? NODE_SIZE.height,
	};
}

export function occupiedRects(nodes: readonly StrategyFlowNode[], edges: readonly StrategyFlowEdge[]): Rect[] {
	const rects = new Map(nodes.map((node) => [node.id, nodeRect(node)]));
	const labels = edges.flatMap((edge) => {
		const from = rects.get(edge.source);
		const to = rects.get(edge.target);
		const label = edge.data?.label ?? '';
		if (!from || !to || label === '') return [];
		const width = Math.min(label.length * LABEL_CHAR_WIDTH + LABEL_PADDING, LABEL_MAX_WIDTH);
		const centerX = (from.x + from.width / 2 + to.x + to.width / 2) / 2;
		const centerY = (from.y + from.height + to.y) / 2;
		return [{ x: centerX - width / 2, y: centerY - LABEL_HEIGHT / 2, width, height: LABEL_HEIGHT }];
	});
	return [...rects.values(), ...labels];
}

export function findFreeSpot(candidate: Point, occupied: readonly Rect[]): Point {
	let spot = candidate;
	while (occupied.some((rect) => overlaps({ ...spot, ...NODE_SIZE }, rect))) {
		spot = { x: spot.x, y: spot.y + OVERLAP_STEP };
	}
	return spot;
}

export function isInside(rect: Rect, view: Rect): boolean {
	return (
		rect.x >= view.x &&
		rect.y >= view.y &&
		rect.x + rect.width <= view.x + view.width &&
		rect.y + rect.height <= view.y + view.height
	);
}
