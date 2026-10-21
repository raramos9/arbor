import { MarkerType, type Edge, type Node } from '@xyflow/react';
import { reactionGroup, type StrategyDoc, type StrategyEdge } from '../model/strategy';
import type { EdgeId, NodeId } from '../model/strategy';

// A reaction selection names the group by its leader edge; the members are recomputed so the selection never goes stale.
export type Selection =
	| { type: 'node'; id: NodeId }
	| { type: 'edge'; id: EdgeId }
	| { type: 'reaction'; id: EdgeId }
	| null;

export type StrategyNodeData = {
	name: string;
	isRoot: boolean;
	isEnd: boolean;
	mediaCount: number;
	editing: boolean;
};
export type StrategyFlowNode = Node<StrategyNodeData, 'strategy'>;
// Outcomes of one reaction share a fork: one trunk from the source, one pill, then a branch to each target.
export type EdgeFork = { leader: boolean; targets: string[]; selected: boolean };
export type StrategyEdgeData = { label: string; mediaCount: number; editing: boolean; fork: EdgeFork | null };
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
	editing: Selection,
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
				editing: editing?.type === 'node' && editing.id === node.id,
			},
			selected: selection?.type === 'node' && selection.id === node.id,
			...(size ? { measured: size } : {}),
		};
	});
}

export function selectedEdgeIds(doc: StrategyDoc, selection: Selection): Set<EdgeId> {
	if (selection?.type === 'edge') return new Set([selection.id]);
	if (selection?.type === 'reaction') return new Set(reactionGroup(doc, selection.id));
	return new Set();
}

// Keeps the selection pointing at something that still exists.
// A reaction that has shrunk to one outcome becomes that outcome's connection, unless its words were just cleared.
export function settleSelection(doc: StrategyDoc, selection: Selection): Selection {
	if (!selection) return selection;
	if (selection.type === 'node') return doc.nodes[selection.id] ? selection : null;
	const leader = doc.edges[selection.id];
	if (!leader) return null;
	if (selection.type === 'reaction' && leader.label !== '' && reactionGroup(doc, selection.id).length < 2) {
		return { type: 'edge', id: selection.id };
	}
	return selection;
}

function forkOf(doc: StrategyDoc, edge: StrategyEdge, selected: ReadonlySet<EdgeId>): EdgeFork | null {
	const group = reactionGroup(doc, edge.id);
	if (group.length < 2) return null;
	return {
		leader: group[0] === edge.id,
		targets: group.map((id) => doc.edges[id]!.to),
		selected: group.some((id) => selected.has(id)),
	};
}

export function toFlowEdges(doc: StrategyDoc, selection: Selection, editing: Selection): StrategyFlowEdge[] {
	const selected = selectedEdgeIds(doc, selection);
	return Object.values(doc.edges).map((edge) => ({
		id: edge.id,
		type: 'strategy',
		source: edge.from,
		target: edge.to,
		data: {
			label: edge.label,
			mediaCount: edge.media.length,
			editing: editing?.type === 'edge' && editing.id === edge.id,
			fork: forkOf(doc, edge, selected),
		},
		ariaLabel: edgeAriaLabel(doc, edge),
		markerEnd: { type: MarkerType.ArrowClosed },
		selected: selected.has(edge.id),
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
const CLIP_ICON_WIDTH = 28;
const CLIP_ICON_GAP = 5;

function pillWidth(label: string, hasMedia: boolean): number {
	if (label === '') return CLIP_ICON_WIDTH;
	const text = label.length * LABEL_CHAR_WIDTH + LABEL_PADDING;
	return hasMedia ? text + CLIP_ICON_WIDTH - LABEL_PADDING + CLIP_ICON_GAP : text;
}

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
		const fork = edge.data?.fork ?? null;
		const label = fork && !fork.leader ? '' : (edge.data?.label ?? '');
		const hasMedia = (edge.data?.mediaCount ?? 0) > 0;
		if (!from || !to || (label === '' && !hasMedia)) return [];
		const width = Math.min(pillWidth(label, hasMedia), LABEL_MAX_WIDTH);
		const targets = fork?.leader ? fork.targets.flatMap((id) => rects.get(id) ?? []) : [to];
		const point = forkPoint(
			{ x: from.x + from.width / 2, y: from.y + from.height },
			targets.map((rect) => ({ x: rect.x + rect.width / 2, y: rect.y })),
		);
		const centerX = point.x;
		const centerY = point.y;
		return [{ x: centerX - width / 2, y: centerY - LABEL_HEIGHT / 2, width, height: LABEL_HEIGHT }];
	});
	return [...rects.values(), ...labels];
}

// Halfway from the source handle to the average of the targets' handles.
export function forkPoint(source: Point, targets: readonly Point[]): Point {
	if (targets.length === 0) return source;
	const x = targets.reduce((sum, t) => sum + t.x, 0) / targets.length;
	const y = targets.reduce((sum, t) => sum + t.y, 0) / targets.length;
	return { x: (source.x + x) / 2, y: (source.y + y) / 2 };
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

const REACTION_GAP_X = 40;
const REACTION_GAP_Y = 60;

export function reactionSource(doc: StrategyDoc, selection: Selection): NodeId {
	if (selection?.type === 'node' && doc.nodes[selection.id]) return selection.id;
	if (selection?.type === 'edge' || selection?.type === 'reaction') {
		const edge = doc.edges[selection.id];
		if (edge) return edge.to;
	}
	return doc.rootNodeId;
}

// Beside the rightmost outcome of the reaction, in its row.
export function optionSpot(outcomes: readonly Rect[], occupied: readonly Rect[]): Point {
	const rightmost = outcomes.reduce<Rect | null>((best, rect) => (!best || rect.x + rect.width > best.x + best.width ? rect : best), null);
	if (!rightmost) return findFreeSpot({ x: 0, y: 0 }, occupied);
	return findFreeSpot({ x: rightmost.x + rightmost.width + REACTION_GAP_X, y: rightmost.y }, occupied);
}

export function reactionSpot(source: Rect, childCount: number, occupied: readonly Rect[]): Point {
	const candidate = {
		x: source.x + childCount * (NODE_SIZE.width + REACTION_GAP_X),
		y: source.y + source.height + REACTION_GAP_Y,
	};
	return findFreeSpot(candidate, occupied);
}
