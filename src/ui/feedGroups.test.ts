import { describe, expect, it } from 'vitest';
import { armDragDoc } from '../model/fixtures';
import type { Position } from '../model/positions';
import { PublishedIdSchema, HandleSchema, type Side } from '../model/strategy';
import type { PublishedSummary } from '../model/publishing';
import { groupByStart } from './feedGroups';

let counter = 0;
function summary(position: Position | null, startingSide: Side): PublishedSummary {
	counter += 1;
	const doc = armDragDoc();
	doc.position = position;
	doc.startingSide = startingSide;
	return {
		id: PublishedIdSchema.parse(`00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`),
		handle: HandleSchema.parse('alice'),
		updatedAt: '2026-10-15T00:00:00Z',
		doc,
	};
}

const closed = (side: Side) => summary({ kind: 'listed', id: 'closed-guard' }, side);

describe('groupByStart', () => {
	it('splits the same position by side and orders groups by first appearance', () => {
		const a = closed('bottom');
		const b = closed('top');
		const c = closed('bottom');
		const groups = groupByStart([a, b, c]);
		expect(groups.map((g) => g.heading)).toEqual(['Closed guard · bottom', 'Closed guard · top']);
		expect(groups[0]?.items).toEqual([a, c]);
	});

	it('merges other positions case- and whitespace-insensitively, headed by the first name as typed', () => {
		const groups = groupByStart([
			summary({ kind: 'other', name: 'Lasso guard' }, 'bottom'),
			summary({ kind: 'other', name: ' lasso GUARD ' }, 'bottom'),
		]);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.heading).toBe('Lasso guard · bottom');
		expect(groups[0]?.items).toHaveLength(2);
	});

	it('names a null position and the standing-on-standing case', () => {
		const groups = groupByStart([
			summary(null, 'top'),
			summary({ kind: 'listed', id: 'standing' }, 'standing'),
			summary({ kind: 'listed', id: 'standing' }, 'top'),
		]);
		expect(groups.map((g) => g.heading)).toEqual(['No starting position · top', 'Standing', 'Standing · top']);
	});

	it('returns nothing for no items', () => {
		expect(groupByStart([])).toEqual([]);
	});

	it('files an Other name that matches a listed position under the listed group', () => {
		const listed = summary({ kind: 'listed', id: 'standing' }, 'standing');
		const typed = summary({ kind: 'other', name: ' standing' }, 'standing');
		const guard = summary({ kind: 'other', name: 'CLOSED GUARD' }, 'bottom');
		const groups = groupByStart([typed, listed, guard]);
		expect(groups.map((g) => g.heading)).toEqual(['Standing', 'Closed guard · bottom']);
		expect(groups[0]?.items).toEqual([typed, listed]);
	});
});
