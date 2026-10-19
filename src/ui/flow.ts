import { MarkerType, type Edge, type Node } from '@xyflow/react';
import type { StrategyDoc, StrategyEdge } from '../model/strategy';
import type { EdgeId, NodeId } from '../model/strategy';

export type Selection = { type: 'node'; id: NodeId } | { type: 'edge'; id: EdgeId } | null;

export type StrategyNodeData = { name: string; isRoot: boolean; mediaCount: number };
export type StrategyFlowNode = Node<StrategyNodeData, 'strategy'>;
export type Size = { width: number; height: number };

const GRID_COLUMNS = 4;
const GRID_X = 240;
const GRID_Y = 150;

function autoPosition(index: number) {
	return { x: (index % GRID_COLUMNS) * GRID_X, y: Math.floor(index / GRID_COLUMNS) * GRID_Y };
}

export function toFlowNodes(
	doc: StrategyDoc,
	selection: Selection,
	measured: Record<string, Size>,
): StrategyFlowNode[] {
	return Object.values(doc.nodes).map((node, index) => {
		const size = measured[node.id];
		return {
			id: node.id,
			type: 'strategy',
			position: doc.layout[node.id] ?? autoPosition(index),
			data: {
				name: node.name,
				isRoot: node.id === doc.rootNodeId,
				mediaCount: node.media.length,
			},
			selected: selection?.type === 'node' && selection.id === node.id,
			...(size ? { measured: size } : {}),
		};
	});
}

export function edgeLabel(edge: StrategyEdge): string {
	if (edge.media.length === 0) return edge.label;
	return edge.label === '' ? '▶' : `${edge.label} ▶`;
}

export function toFlowEdges(doc: StrategyDoc, selection: Selection): Edge[] {
	return Object.values(doc.edges).map((edge) => ({
		id: edge.id,
		source: edge.from,
		target: edge.to,
		label: edgeLabel(edge),
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

function nodeRect(node: StrategyFlowNode): Rect {
	return {
		x: node.position.x,
		y: node.position.y,
		width: node.measured?.width ?? NODE_SIZE.width,
		height: node.measured?.height ?? NODE_SIZE.height,
	};
}

export function occupiedRects(nodes: readonly StrategyFlowNode[], edges: readonly Edge[]): Rect[] {
	const rects = new Map(nodes.map((node) => [node.id, nodeRect(node)]));
	const labels = edges.flatMap((edge) => {
		const from = rects.get(edge.source);
		const to = rects.get(edge.target);
		if (!from || !to || typeof edge.label !== 'string' || edge.label === '') return [];
		const width = edge.label.length * LABEL_CHAR_WIDTH + LABEL_PADDING;
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
