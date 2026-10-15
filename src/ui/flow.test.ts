import { describe, expect, it } from 'vitest';
import { EdgeIdSchema, NodeIdSchema, type Media } from '../model/strategy';
import { edgeLabel, findFreeSpot, isInside, NODE_SIZE } from './flow';

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
		expect(edgeLabel({ ...base, actor: 'me', label: 'Sweep', media: [] })).toBe('Sweep');
	});
	it('appends a marker when media exists', () => {
		expect(edgeLabel({ ...base, actor: 'me', label: 'Sweep', media: [clip] })).toBe('Sweep ▶');
	});
	it('shows only the marker for an empty label', () => {
		expect(edgeLabel({ ...base, actor: 'me', label: '', media: [clip] })).toBe('▶');
	});
});
