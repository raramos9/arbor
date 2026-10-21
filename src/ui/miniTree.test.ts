import { describe, expect, it } from 'vitest';
import { armDragDoc } from '../model/fixtures';
import { EdgeIdSchema, NodeIdSchema, type StrategyDoc } from '../model/strategy';
import { miniTree, plural, strategyStats, timeAgo } from './miniTree';
import { toOutline } from './outline';

function graph(nodeNames: string[], links: [string, string, string?][]): StrategyDoc {
	const doc = armDragDoc();
	doc.rootNodeId = NodeIdSchema.parse(nodeNames[0]);
	doc.nodes = {};
	doc.edges = {};
	for (const id of nodeNames) doc.nodes[id] = { id: NodeIdSchema.parse(id), name: id, notes: '', media: [] };
	links.forEach(([from, to, label = ''], index) => {
		const id = `e${index}`;
		doc.edges[id] = {
			id: EdgeIdSchema.parse(id),
			from: NodeIdSchema.parse(from),
			to: NodeIdSchema.parse(to),
			label,
			notes: '',
			media: [],
		};
	});
	return doc;
}

describe('miniTree', () => {
	it('draws a lone start as one dot', () => {
		expect(miniTree(toOutline(graph(['a'], [])))).toEqual({
			dots: [{ x: 0, y: 0, kind: 'start' }],
			links: [],
			columns: 1,
			rows: 1,
			clipped: false,
			hidden: 0,
		});
	});

	it('centres a parent on its children and marks line ends and reactions', () => {
		const tree = miniTree(toOutline(armDragDoc()));
		expect(tree.rows).toBe(2);
		expect(tree.columns).toBe(3);
		expect(tree.dots).toContainEqual({ x: 0, y: 0.5, kind: 'start' });
		expect(tree.dots).toContainEqual({ x: 1, y: 0.5, kind: 'step' });
		expect(tree.dots.filter((dot) => dot.kind === 'end')).toEqual([
			{ x: 2, y: 0, kind: 'end' },
			{ x: 2, y: 1, kind: 'end' },
		]);
		expect(tree.links).toContainEqual({ x1: 0, y1: 0.5, x2: 1, y2: 0.5, reaction: false });
		expect(tree.links.filter((link) => link.reaction)).toHaveLength(2);
	});

	it('forks outcomes that share a reaction from one point', () => {
		const doc = graph(['a', 'b', 'c', 'd'], [['a', 'b', 'posts arm out'], ['a', 'c', 'posts arm out'], ['a', 'd', 'he sits back']]);
		const tree = miniTree(toOutline(doc));
		expect(tree.hidden).toBe(0);
		expect(tree.dots).toContainEqual({ x: 0.5, y: 0.5, kind: 'fork' });
		expect(tree.links).toContainEqual({ x1: 0.5, y1: 0.5, x2: 1, y2: 0, reaction: true });
		expect(tree.links).toContainEqual({ x1: 0.5, y1: 0.5, x2: 1, y2: 1, reaction: true });
		expect(tree.links).toContainEqual({ x1: 0, y1: 1.25, x2: 0.5, y2: 0.5, reaction: true });
		expect(tree.links).toContainEqual({ x1: 0, y1: 1.25, x2: 1, y2: 2, reaction: true });
	});

	it('draws a rejoin as a jump dot', () => {
		const tree = miniTree(toOutline(graph(['a', 'b'], [['a', 'b'], ['b', 'a', 'he escapes']])));
		expect(tree.dots).toContainEqual({ x: 2, y: 0, kind: 'jump' });
	});

	it('stops at the row and depth limits', () => {
		const wide = graph(
			['a', 'b', 'c', 'd', 'e'],
			[['a', 'b'], ['a', 'c'], ['a', 'd'], ['a', 'e']],
		);
		const tree = miniTree(toOutline(wide), { depth: 7, rows: 2 });
		expect(tree.rows).toBe(2);
		expect(tree.dots).toHaveLength(3);
		expect(tree.clipped).toBe(true);
		expect(tree.hidden).toBe(2);

		const deep = graph(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]);
		const shallow = miniTree(toOutline(deep), { depth: 2, rows: 7 });
		expect(shallow.columns).toBe(2);
		expect(shallow.dots).toContainEqual({ x: 1, y: 0, kind: 'step' });
		expect(shallow.clipped).toBe(true);
		expect(shallow.hidden).toBe(1);
	});
});

describe('strategyStats', () => {
	it('counts steps, labelled reactions and line ends', () => {
		expect(strategyStats(armDragDoc())).toEqual({ steps: 4, reactions: 2, ends: 2 });
	});
});

describe('plural', () => {
	it('picks the singular for one', () => {
		expect(plural(1, 'step')).toBe('1 step');
		expect(plural(3, 'approach', 'approaches')).toBe('3 approaches');
	});
});

describe('timeAgo', () => {
	const now = Date.parse('2026-10-20T12:00:00Z');
	it('rounds to the largest unit', () => {
		expect(timeAgo('2026-10-20T11:59:30Z', now)).toBe('just now');
		expect(timeAgo('2026-10-20T09:00:00Z', now)).toBe('3 hours ago');
		expect(timeAgo('2026-10-19T12:00:00Z', now)).toBe('yesterday');
		expect(timeAgo('2026-09-20T12:00:00Z', now)).toBe('last month');
		expect(timeAgo('not a date', now)).toBe('');
	});
});
