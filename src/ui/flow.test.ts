import { describe, expect, it } from 'vitest';
import { EdgeIdSchema, NodeIdSchema, type Media } from '../model/strategy';
import { armDragDoc } from '../model/fixtures';
import {
	edgeAriaLabel,
	findFreeSpot,
	nodeAriaLabel,
	isInside,
	NODE_SIZE,
	occupiedRects,
	reactionSource,
	optionSpot,
	reactionSpot,
	selectedEdgeIds,
	pillKeyAction,
	settleSelection,
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
		data: { name: id, isRoot: false, isEnd: false, mediaCount: 0, editing: false },
	});
	const nodes = [node('a', 0), node('b', 300)];
	const edge = (label: string, mediaCount = 0): StrategyFlowEdge => ({
		id: 'e',
		type: 'strategy',
		source: 'a',
		target: 'b',
		data: { label, mediaCount, editing: false, fork: null },
	});

	it('keeps a new node below a connected node off the label', () => {
		const label = { x: 0, y: (NODE_SIZE.height + 300) / 2, width: 1, height: 1 };
		const spot = findFreeSpot({ x: 0, y: 140 }, occupiedRects(nodes, [edge('He circles his arm in')]));
		expect(isInside(label, { ...spot, ...NODE_SIZE })).toBe(false);
	});

	it('reserves nothing for an unlabeled connection', () => {
		expect(occupiedRects(nodes, [edge('')])).toHaveLength(2);
	});

	it('reserves the icon pill for a clip-only connection', () => {
		const [, , pill] = occupiedRects(nodes, [edge('', 1)]);
		expect(pill?.width).toBeGreaterThan(0);
		expect(pill?.width).toBeLessThan(40);
	});

	it('reserves more for a reaction that also has clips', () => {
		const [, , plain] = occupiedRects(nodes, [edge('Circles in')]);
		const [, , withClip] = occupiedRects(nodes, [edge('Circles in', 1)]);
		expect(withClip!.width).toBeGreaterThan(plain!.width);
	});

	it('reserves no wider than the truncated pill for a long reaction', () => {
		const [, , label] = occupiedRects(nodes, [edge('He '.repeat(100))]);
		expect(label?.width).toBe(200);
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

function sharedReactionDoc() {
	const doc = armDragDoc();
	doc.edges['e3'] = { ...doc.edges['e3']!, label: 'arm stays displaced' };
	return doc;
}

describe('selectedEdgeIds', () => {
	const doc = sharedReactionDoc();
	const eid = (s: string) => EdgeIdSchema.parse(s);

	it('is the whole group for a reaction, however it is reached', () => {
		expect([...selectedEdgeIds(doc, { type: 'reaction', id: eid('e2') })].sort()).toEqual(['e2', 'e3']);
	});
	it('is just the edge for an edge, and empty otherwise', () => {
		expect([...selectedEdgeIds(doc, { type: 'edge', id: eid('e3') })]).toEqual(['e3']);
		expect(selectedEdgeIds(doc, { type: 'node', id: NodeIdSchema.parse('triangle') }).size).toBe(0);
		expect(selectedEdgeIds(doc, null).size).toBe(0);
	});
});

describe('settleSelection', () => {
	const eid = (s: string) => EdgeIdSchema.parse(s);

	it('keeps a reaction selection while it still has several outcomes', () => {
		const selection = { type: 'reaction', id: eid('e2') } as const;
		expect(settleSelection(sharedReactionDoc(), selection)).toBe(selection);
	});
	it('falls back to the survivor when the group shrinks to one', () => {
		expect(settleSelection(armDragDoc(), { type: 'reaction', id: eid('e2') })).toEqual({ type: 'edge', id: 'e2' });
	});
	it('drops a selection whose target is gone', () => {
		expect(settleSelection(armDragDoc(), { type: 'reaction', id: eid('ghost') })).toBeNull();
		expect(settleSelection(armDragDoc(), { type: 'edge', id: eid('ghost') })).toBeNull();
		expect(settleSelection(armDragDoc(), { type: 'node', id: NodeIdSchema.parse('ghost') })).toBeNull();
	});
});

describe('toFlowEdges', () => {
	const clip: Media = { provider: 'web', title: '', url: 'https://example.com' };

	it('carries the reaction and clip count as edge data', () => {
		const doc = armDragDoc();
		doc.edges['e2'] = { ...doc.edges['e2']!, media: [clip, clip] };
		const edges = toFlowEdges(doc, null, null);
		expect(edges.map((edge) => edge.data)).toEqual([
			{ label: '', mediaCount: 0, editing: false, fork: null },
			{ label: 'Arm stays displaced', mediaCount: 2, editing: false, fork: null },
			{ label: 'Arm wraps around my back', mediaCount: 0, editing: false, fork: null },
		]);
		expect(edges.every((edge) => edge.type === 'strategy' && edge.label === undefined)).toBe(true);
	});

	it('forks outcomes of one reaction, with the first one carrying the pill', () => {
		const doc = armDragDoc();
		doc.edges['e3'] = { ...doc.edges['e3']!, label: 'arm stays displaced' };
		const forks = toFlowEdges(doc, null, null).map((edge) => edge.data?.fork);
		expect(forks).toEqual([
			null,
			{ leader: true, targets: ['back-take', 'triangle'], selected: false },
			{ leader: false, targets: ['back-take', 'triangle'], selected: false },
		]);
	});

	it('marks only the selected edge', () => {
		const doc = armDragDoc();
		const edges = toFlowEdges(doc, { type: 'edge', id: EdgeIdSchema.parse('e2') }, null);
		expect(edges.map((edge) => edge.selected)).toEqual([false, true, false]);
		expect(edges[1]!.ariaLabel).toBe(edgeAriaLabel(doc, doc.edges['e2']!));
	});

	it('marks every outcome and the pill when the reaction is selected', () => {
		const doc = sharedReactionDoc();
		const edges = toFlowEdges(doc, { type: 'reaction', id: EdgeIdSchema.parse('e2') }, null);
		expect(edges.map((edge) => edge.selected)).toEqual([false, true, true]);
		expect(edges.map((edge) => edge.data?.fork?.selected)).toEqual([undefined, true, true]);
	});

	it('lights the pill, but only the one path, when a single outcome is selected', () => {
		const doc = sharedReactionDoc();
		const edges = toFlowEdges(doc, { type: 'edge', id: EdgeIdSchema.parse('e3') }, null);
		expect(edges.map((edge) => edge.selected)).toEqual([false, false, true]);
		expect(edges.map((edge) => edge.data?.fork?.selected)).toEqual([undefined, true, true]);
	});

	it('marks only the edge being edited', () => {
		const edges = toFlowEdges(armDragDoc(), null, { type: 'edge', id: EdgeIdSchema.parse('e2') });
		expect(edges.map((edge) => edge.data?.editing)).toEqual([false, true, false]);
	});
});

describe('toFlowNodes', () => {
	it('marks only the node being edited', () => {
		const nodes = toFlowNodes(armDragDoc(), null, { type: 'node', id: NodeIdSchema.parse('arm-drag') }, {});
		expect(nodes.map((node) => node.data.editing)).toEqual([false, true, false, false]);
	});

	it('flags nodes with no outgoing connection as line ends', () => {
		const nodes = toFlowNodes(armDragDoc(), null, null, {});
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

describe('reactionSource', () => {
	const doc = armDragDoc();

	it('uses the selected node', () => {
		expect(reactionSource(doc, { type: 'node', id: NodeIdSchema.parse('back-take') })).toBe('back-take');
	});

	it('uses the target of the selected edge', () => {
		expect(reactionSource(doc, { type: 'edge', id: EdgeIdSchema.parse('e2') })).toBe('back-take');
	});

	it('uses the target of the leader for a reaction', () => {
		expect(reactionSource(doc, { type: 'reaction', id: EdgeIdSchema.parse('e2') })).toBe('back-take');
	});

	it('falls back to the start node', () => {
		expect(reactionSource(doc, null)).toBe(doc.rootNodeId);
	});
});

describe('optionSpot', () => {
	it('lands beside the rightmost outcome, in its row', () => {
		const a = { x: 0, y: 200, width: 150, height: 40 };
		const b = { x: 300, y: 200, width: 180, height: 40 };
		expect(optionSpot([a, b], [a, b])).toEqual({ x: 520, y: 200 });
	});
	it('steps down when that spot is taken', () => {
		const a = { x: 0, y: 200, width: 150, height: 40 };
		const blocker = { x: 190, y: 200, width: 150, height: 40 };
		expect(optionSpot([a], [a, blocker]).y).toBeGreaterThan(200);
	});
});

describe('reactionSpot', () => {
	const source = { x: 100, y: 50, ...NODE_SIZE };

	it('puts the first reaction directly below the source', () => {
		const spot = reactionSpot(source, 0, [source]);
		expect(spot.x).toBe(source.x);
		expect(spot.y).toBeGreaterThan(source.y + source.height);
	});

	it('puts the second reaction to the right of the first', () => {
		const first = reactionSpot(source, 0, [source]);
		const second = reactionSpot(source, 1, [source, { ...first, ...NODE_SIZE }]);
		expect(second.y).toBe(first.y);
		expect(second.x).toBeGreaterThanOrEqual(first.x + NODE_SIZE.width);
	});

	it('skips an occupied spot', () => {
		const first = reactionSpot(source, 0, [source]);
		const spot = reactionSpot(source, 0, [source, { ...first, ...NODE_SIZE }]);
		expect(spot.x).toBe(first.x);
		expect(spot.y).toBeGreaterThanOrEqual(first.y + NODE_SIZE.height);
	});
});

describe('pillKeyAction', () => {
	const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({
		key: k,
		metaKey: false,
		ctrlKey: false,
		altKey: false,
		...mods,
	});

	it('renames a selected pill on Enter instead of clicking it again', () => {
		expect(pillKeyAction(key('Enter'), true)).toBe('rename');
	});

	it('leaves Enter on an unselected pill to the button, which selects it', () => {
		expect(pillKeyAction(key('Enter'), false)).toBeNull();
	});

	it('ignores Enter with a modifier', () => {
		expect(pillKeyAction(key('Enter', { metaKey: true }), true)).toBeNull();
		expect(pillKeyAction(key('Enter', { ctrlKey: true }), true)).toBeNull();
	});
});
