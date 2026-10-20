import { describe, expect, it } from 'vitest';
import { EdgeIdSchema, type Media } from '../model/strategy';
import { armDragDoc } from '../model/fixtures';
import {
	edgeAriaLabel,
	findFreeSpot,
	nodeAriaLabel,
	isInside,
	NODE_SIZE,
	occupiedRects,
	toFlowEdges,
	toFlowNodes,
	type StrategyFlowEdge,
	type StrategyFlowNode,
} from './flow';

describe('findFreeSpot', () => {
	it('returns the candidate on an empty canvas', () => {
		expect(findFreeSpot({ x: 10, y: 20 }, [])).toEqual({ x: 10, y: 20 });
	});

	it('moves a blocked candidate down until clear', () => {
		const occupied = [{ x: 0, y: 0, ...NODE_SIZE }];
		const spot = findFreeSpot({ x: 0, y: 0 }, occupied);
		expect(spot.x).toBe(0);
		expect(spot.y).toBeGreaterThanOrEqual(NODE_SIZE.height);
		const second = findFreeSpot({ x: 0, y: 0 }, [...occupied, { x: 0, y: spot.y, ...NODE_SIZE }]);
		expect(second.y).toBeGreaterThan(spot.y);
	});

	it('ignores nodes that do not overlap', () => {
		expect(findFreeSpot({ x: 0, y: 0 }, [{ x: 500, y: 0, ...NODE_SIZE }])).toEqual({ x: 0, y: 0 });
	});
});

describe('occupiedRects', () => {
	const node = (id: string, y: number): StrategyFlowNode => ({
		id,
		type: 'strategy',
		position: { x: 0, y },
		data: { name: id, isRoot: false, isEnd: false, mediaCount: 0 },
	});
	const nodes = [node('a', 0), node('b', 300)];
	const edge = (label: string): StrategyFlowEdge => ({
		id: 'e',
		type: 'strategy',
		source: 'a',
		target: 'b',
		data: { label, mediaCount: 0 },
	});

	it('keeps a new node below a connected node off the label', () => {
		const label = { x: 0, y: (NODE_SIZE.height + 300) / 2, width: 1, height: 1 };
		const spot = findFreeSpot({ x: 0, y: 140 }, occupiedRects(nodes, [edge('He circles his arm in')]));
		expect(isInside(label, { ...spot, ...NODE_SIZE })).toBe(false);
	});

	it('reserves nothing for an unlabeled connection', () => {
		expect(occupiedRects(nodes, [edge('')])).toHaveLength(2);
	});
});

describe('isInside', () => {
	const view = { x: 0, y: 0, width: 400, height: 300 };

	it('is true when the rect is fully within the view', () => {
		expect(isInside({ x: 100, y: 100, ...NODE_SIZE }, view)).toBe(true);
	});

	it('is false when the rect is partly or fully outside the view', () => {
		expect(isInside({ x: 100, y: 250, ...NODE_SIZE }, view)).toBe(false);
		expect(isInside({ x: 500, y: 0, ...NODE_SIZE }, view)).toBe(false);
	});
});

describe('toFlowEdges', () => {
	const clip: Media = { provider: 'web', title: '', url: 'https://example.com' };

	it('carries the reaction and clip count as edge data', () => {
		const doc = armDragDoc();
		doc.edges['e2'] = { ...doc.edges['e2']!, media: [clip, clip] };
		const edges = toFlowEdges(doc, null);
		expect(edges.map((edge) => edge.data)).toEqual([
			{ label: '', mediaCount: 0 },
			{ label: 'Arm stays displaced', mediaCount: 2 },
			{ label: 'Arm wraps around my back', mediaCount: 0 },
		]);
		expect(edges.every((edge) => edge.type === 'strategy' && edge.label === undefined)).toBe(true);
	});

	it('marks only the selected edge', () => {
		const doc = armDragDoc();
		const edges = toFlowEdges(doc, { type: 'edge', id: EdgeIdSchema.parse('e2') });
		expect(edges.map((edge) => edge.selected)).toEqual([false, true, false]);
		expect(edges[1]!.ariaLabel).toBe(edgeAriaLabel(doc, doc.edges['e2']!));
	});
});

describe('toFlowNodes', () => {
	it('flags nodes with no outgoing connection as line ends', () => {
		const nodes = toFlowNodes(armDragDoc(), null, {});
		expect(nodes.map((node) => [node.id, node.data.isEnd])).toEqual([
			['open-guard', false],
			['arm-drag', false],
			['back-take', true],
			['triangle', true],
		]);
		expect(nodes[2]!.ariaLabel).toBe('Back take, line ends');
	});
});

describe('aria labels', () => {
	it('names a node by its name, start flag, and clips', () => {
		expect(nodeAriaLabel('Open guard', true, 2, false)).toBe('Open guard, start, 2 clips');
		expect(nodeAriaLabel('', false, 1, false)).toBe('Untitled, 1 clip');
		expect(nodeAriaLabel('Triangle', false, 0, true)).toBe('Triangle, line ends');
	});

	it('names a connection by its ends and reaction', () => {
		const doc = armDragDoc();
		expect(edgeAriaLabel(doc, doc.edges['e2']!)).toBe('Arm drag to Back take, reaction: Arm stays displaced');
		expect(edgeAriaLabel(doc, doc.edges['e1']!)).toBe('Open guard to Arm drag');
	});
});
