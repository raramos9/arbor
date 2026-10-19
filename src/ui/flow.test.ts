import { describe, expect, it } from 'vitest';
import { EdgeIdSchema, NodeIdSchema, type Media } from '../model/strategy';
import type { Edge } from '@xyflow/react';
import { edgeLabel, findFreeSpot, isInside, NODE_SIZE, occupiedRects, type StrategyFlowNode } from './flow';

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
		data: { name: id, isRoot: false, mediaCount: 0 },
	});
	const nodes = [node('a', 0), node('b', 300)];
	const edge = (label: string): Edge => ({ id: 'e', source: 'a', target: 'b', label });

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

describe('edgeLabel', () => {
	const base = { id: EdgeIdSchema.parse('e'), from: NodeIdSchema.parse('a'), to: NodeIdSchema.parse('b'), notes: '' };
	const clip: Media = { provider: 'web', title: '', url: 'https://example.com' };

	it('leaves the label alone without media', () => {
		expect(edgeLabel({ ...base, label: 'Sweep', media: [] })).toBe('Sweep');
	});
	it('appends a marker when media exists', () => {
		expect(edgeLabel({ ...base, label: 'Sweep', media: [clip] })).toBe('Sweep ▶');
	});
	it('shows only the marker for an empty label', () => {
		expect(edgeLabel({ ...base, label: '', media: [clip] })).toBe('▶');
	});
});
